# Hosting — DigitalOcean droplet deploy runbook

The path we actually took. Sibling to [`hosting.md`](./hosting.md) (Fly.io
plan) — this one is a plain Ubuntu droplet with nginx + Let's Encrypt +
a systemd-managed Next.js process. Simpler than Fly for a single-node
SQLite app; you own the box and the ops.

## 0. Assumptions

- Fresh Ubuntu 24.04 LTS droplet with root SSH access.
- Public IPv4.
- A domain you control. Google OAuth and Let's Encrypt both need a real
  hostname over HTTPS; a raw IP will not work.
- **Sizing:** 1 GB RAM ($6/mo Basic) is the comfortable minimum. The
  512 MB tier works but needs 4 GB swap + `NODE_OPTIONS=--max-old-space-size=1024`
  and turns a 90-second build into an 8–15 minute one.

Placeholders used throughout: `<droplet-ip>`, `<your-domain>`,
`<your-email>`. Replace with real values.

## 1. Harden the droplet

SSH in as root, then create a sudo user and lock down SSH:

```bash
# On your Mac
ssh root@<droplet-ip>

# As root
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy-nopasswd
chmod 440 /etc/sudoers.d/deploy-nopasswd
```

Verify you can log in as `deploy` from a **second** Mac terminal before
proceeding — root is your escape hatch until then:

```bash
ssh deploy@<droplet-ip>
```

Then disable root login and password auth:

```bash
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo sshd -t && sudo systemctl reload ssh
```

Firewall — open only SSH, HTTP, HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 2. Install runtime deps

```bash
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt -y upgrade
sudo apt install -y curl ca-certificates gnupg build-essential python3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm@9
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

Reboot if `/var/run/reboot-required` exists after the upgrade.

**Small droplet (< 1 GB RAM):** add swap now so the build doesn't OOM.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
```

## 3. Clone and install (do NOT build yet)

```bash
cd ~
git clone https://github.com/<your-github-user>/NoTomorrow.git
cd NoTomorrow
pnpm install --network-concurrency=4 --child-concurrency=2
```

`better-sqlite3` compiles from source on install — the `build-essential`
+ `python3` from step 2 is why. If the compile step is missing after
install, run `pnpm rebuild better-sqlite3` explicitly.

Data directory lives **outside the repo** so `git pull` never touches
the DB:

```bash
mkdir -p ~/notomorrow-data
chmod 700 ~/notomorrow-data
```

## 4. Production env file

```bash
openssl rand -hex 32  # copy the output for AUTH_SECRET
```

Write `apps/web/.env.local`:

```bash
cat > ~/NoTomorrow/apps/web/.env.local <<'EOF'
NOTOMORROW_AUTH=cloud
SQLITE_DB_PATH=/home/deploy/notomorrow-data/notomorrow.db
AUTH_SECRET=<paste-the-openssl-hex>
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
EOF
chmod 600 ~/NoTomorrow/apps/web/.env.local
```

Notes:

- `AUTH_TRUST_HOST=true` is required behind nginx; without it Auth.js
  rejects requests with an "Untrusted host" error.
- The Google lines stay empty until Step 7. The
  `hasGoogleOAuth()` helper in `apps/web/lib/oauth-config.ts` hides
  the button when creds are unset, so the site works end-to-end
  with password auth alone.
- No `NEXTAUTH_URL` needed with `AUTH_TRUST_HOST=true`.

Build:

```bash
cd ~/NoTomorrow

# 1 GB+ RAM:
pnpm --filter web build

# 512 MB RAM:
NODE_OPTIONS="--max-old-space-size=1024" pnpm --filter web build
```

## 5. systemd service

```bash
sudo tee /etc/systemd/system/notomorrow.service > /dev/null <<'EOF'
[Unit]
Description=NoTomorrow web (Next.js)
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/NoTomorrow/apps/web
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/pnpm start -- -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now notomorrow.service
sudo journalctl -u notomorrow.service -n 20 --no-pager
```

Why the flags on `ExecStart`: `next start` in Next 15 inconsistently
honors the `HOSTNAME`/`PORT` env vars. Passing `-H 127.0.0.1 -p 3000`
explicitly binds it to loopback so nginx is the only public face.

Verify locally on the droplet:

```bash
curl -sIL http://127.0.0.1:3000/ | grep -E "^HTTP"
```

Expect a 2xx or 3xx from your app.

## 6. Nginx + Let's Encrypt

Write the site config (HTTP only for now — certbot will add TLS):

```bash
sudo tee /etc/nginx/sites-available/notomorrow > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name <your-domain> www.<your-domain>;

    client_max_body_size 5m;

    set_real_ip_from 127.0.0.1;
    real_ip_header X-Forwarded-For;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout  60s;
        proxy_send_timeout  60s;
        proxy_connect_timeout 10s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/notomorrow /etc/nginx/sites-enabled/notomorrow
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

DNS prep: point A records for `@` and `www` at the droplet IP. If using
Cloudflare, keep both records **DNS only (grey cloud)** — the orange
proxy interferes with certbot's HTTP-01 challenge and hides real client
IPs. Turn it on later, after TLS is verified, with SSL mode set to
**Full (strict)**.

Then get the cert:

```bash
sudo certbot --nginx \
  -d <your-domain> -d www.<your-domain> \
  --non-interactive --agree-tos --email <your-email> \
  --redirect
```

`--redirect` adds the 301 HTTP → HTTPS rewrite in the nginx config.
Certbot installs a systemd timer for automatic renewal.

Verify:

```bash
curl -sI https://<your-domain>/ | head -3
curl -sI http://<your-domain>/  | head -3  # expect 301
systemctl list-timers | grep certbot
```

## 7. Google OAuth (optional)

Skip if you only need email/password auth.

1. https://console.cloud.google.com/apis/credentials → **Create OAuth
   client ID** → Web application.
2. Authorized JS origins:
   ```
   https://<your-domain>
   https://www.<your-domain>
   ```
3. Authorized redirect URIs:
   ```
   https://<your-domain>/api/auth/callback/google
   https://www.<your-domain>/api/auth/callback/google
   ```
4. Copy Client ID + Secret.
5. Publish the consent screen: https://console.cloud.google.com/apis/credentials/consent
   → **PUBLISH APP**. Non-sensitive scopes (email/profile/openid) do not
   require Google's verification review; you go straight to "In
   production" and any Google user can sign in.

On the droplet:

```bash
sed -i 's|^AUTH_GOOGLE_ID=.*|AUTH_GOOGLE_ID=<paste-client-id>|' ~/NoTomorrow/apps/web/.env.local
sed -i 's|^AUTH_GOOGLE_SECRET=.*|AUTH_GOOGLE_SECRET=<paste-client-secret>|' ~/NoTomorrow/apps/web/.env.local
sudo systemctl restart notomorrow.service
```

Verify the button now renders:

```bash
curl -s https://<your-domain>/ | grep -oE 'Continue with Google'
```

## 8. Smoke test

- Load `https://<your-domain>/` in a browser — valid padlock, no
  certificate warning.
- Register an account. Email verification codes go to logs unless
  `apps/web/lib/mailer.ts` is wired to a real SMTP provider:
  ```bash
  sudo journalctl -u notomorrow.service | grep -i verification
  ```
- Sign in with password. If Google is configured, sign in with a
  non-test-user Google account (proving the consent screen is
  published).

## Update flow

```bash
ssh deploy@<droplet-ip>
cd ~/NoTomorrow
git pull
pnpm install --network-concurrency=4 --child-concurrency=2
pnpm --filter web build  # add NODE_OPTIONS on 512 MB
sudo systemctl restart notomorrow.service
sudo journalctl -u notomorrow.service -n 20 --no-pager
```

Wrap as `~/deploy.sh` for one-liner updates.

## Backups

SQLite live-backup while the service runs (safe — no `cp` on the file):

```bash
sqlite3 /home/deploy/notomorrow-data/notomorrow.db \
  ".backup /home/deploy/notomorrow-data/backup-$(date +%F).db"
```

Wire into cron nightly and rsync to S3/Tigris if data matters.

## Common problems seen the first time

- **`EADDRINUSE :::3000`** — a stray foreground `pnpm start` from an
  earlier terminal is still holding the port. `sudo pkill -f 'next
  start'` then restart the service.
- **`FATAL ERROR: Reached heap limit`** during build on 512 MB — add
  swap and `NODE_OPTIONS=--max-old-space-size=1024` (§2, §4).
- **Certbot "does not point to this server"** — Cloudflare proxy is on.
  Flip both A records to DNS-only.
- **Google sign-in "Access blocked"** — consent screen is still in
  Testing. Publish it (§7).
- **`Killed` mid-`pnpm install`** — OOM. Same swap fix as the build.
