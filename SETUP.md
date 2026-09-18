# NoTomorrow Deployment Setup

This repository deploys the hosted Next.js web app with GitHub Actions.
Secrets and environment-specific values belong in GitHub repository settings,
not in committed files.

## What the Pipeline Does

`.github/workflows/deploy.yml` runs on pull requests to `main`, pushes to
`main`, and manual dispatches.

- Pull requests: install dependencies, lint, typecheck, test, and build the
  web app.
- Pushes to `main` and manual runs from `main`: run the same verification,
  then deploy to the production droplet over SSH.
- Deployment: GitHub Actions builds an immutable release artifact, uploads it
  to the droplet, unpacks it into a versioned release directory, applies SQLite
  migrations, atomically updates a `current` symlink, restarts systemd, checks
  local health, and prunes old releases.

## GitHub Settings

Open the repository on GitHub, then go to:

`Settings` -> `Secrets and variables` -> `Actions`

Add these repository secrets:

| Name | Value |
| --- | --- |
| `DEPLOY_SSH_PRIVATE_KEY` | Private SSH key that can log in as the deploy user on the droplet. Use a dedicated deploy key, not a personal key. |
| `DEPLOY_KNOWN_HOSTS` | The droplet host key line from `ssh-keyscan -p <port> <host>`. |

Add these repository variables:

| Name | Example | Notes |
| --- | --- | --- |
| `DEPLOY_HOST` | `203.0.113.10` | Droplet IP address or DNS name. |
| `DEPLOY_USER` | `deploy` | Linux user that owns the checkout and can restart the service. |
| `DEPLOY_PORT` | `22` | Optional SSH port. Defaults to `22` when empty. |
| `DEPLOY_PATH` | `/home/deploy/notomorrow` | Absolute path to the app deployment directory on the droplet. |
| `DEPLOY_SERVICE` | `notomorrow.service` | Optional systemd service name. Defaults to `notomorrow.service` when empty. |
| `HEALTH_URL` | `http://127.0.0.1:3000/api/health` | Optional local health URL checked after restart. |

If you use GitHub Environments, create a `production` environment and keep the
same secrets and variables available to it, or leave them at repository scope.

## Create the Deploy SSH Key

On your local machine:

```bash
ssh-keygen -t ed25519 -C "github-actions-notomorrow-deploy" -f ./notomorrow_deploy_key
```

Add the public key to the droplet:

```bash
ssh deploy@<droplet-host> 'mkdir -p ~/.ssh && chmod 700 ~/.ssh'
cat ./notomorrow_deploy_key.pub | ssh deploy@<droplet-host> 'cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
```

Store the private key in GitHub as `DEPLOY_SSH_PRIVATE_KEY`.

Create the known-hosts value:

```bash
ssh-keyscan -p 22 <droplet-host>
```

Store the full output line in GitHub as `DEPLOY_KNOWN_HOSTS`.

## Droplet Prerequisites

Prepare the server by following `docs/release/hosting-digitalocean.md`.
At minimum, the droplet must have:

- Node.js 20, nginx, and certbot installed.
- A deployment directory at `DEPLOY_PATH`, owned by the deploy user.
- `DEPLOY_PATH/shared/.env.local` created on the droplet with production values.
- `notomorrow.service` installed and restartable by the deploy user.
- The deploy user allowed to run `sudo systemctl restart notomorrow.service`
  without an interactive password.
- Enough disk space for at least five release directories.

Create the production env file on the droplet. It should stay on the server and
should not be committed:

```bash
mkdir -p /home/deploy/notomorrow/shared
nano /home/deploy/notomorrow/shared/.env.local
chmod 600 /home/deploy/notomorrow/shared/.env.local
```

Use this shape:

```bash
NOTOMORROW_AUTH=cloud
NOTOMORROW_SERVICE_ROLE=web
SQLITE_DB_PATH=/home/deploy/notomorrow-data/notomorrow.db
AUTH_SECRET=<openssl-rand-hex-32>
SOCIAL_MESSAGE_KEY=<openssl-rand-hex-32>
AUTH_TRUST_HOST=true
AUTH_URL=https://<your-domain>
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=common
AUTH_FACEBOOK_ID=
AUTH_FACEBOOK_SECRET=
```

Only set OAuth provider IDs and secrets for providers you use. The login UI
hides providers with missing credentials. `SOCIAL_MESSAGE_KEY` encrypts direct
messages at rest; keep it stable and backed up, because rotating it without a
re-encryption step makes existing messages unreadable.

## systemd Service

The deployment workflow builds a Next.js standalone artifact. Configure systemd
to run the active release through the `current` symlink:

```ini
[Unit]
Description=NoTomorrow web (Next.js standalone)
After=network.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/home/deploy/notomorrow/current/apps/web
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
EnvironmentFile=/home/deploy/notomorrow/shared/.env.local
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## Service Boundaries

NoTomorrow is a modular monolith: one repository and one build artifact, but it
can be deployed as separate path-routed services.

Set `NOTOMORROW_SERVICE_ROLE` per deployment:

| Role | Serves |
| --- | --- |
| `web` | Main app, auth, counters, profile, static assets. Rejects social/message APIs. |
| `social` | `/api/friends` and `/api/friends/*`, plus `/api/health`. |
| `messaging` | `/api/messages/*`, plus `/api/health`. |
| `all` | Everything. Use for local development. |

Route traffic at nginx/load-balancer level on the same public origin so Auth.js
cookies stay same-origin:

```nginx
location /api/friends {
    proxy_pass http://127.0.0.1:3001;
}

location /api/messages {
    proxy_pass http://127.0.0.1:3002;
}

location / {
    proxy_pass http://127.0.0.1:3000;
}
```

Each service can use the same release artifact and shared env file, changing
only `NOTOMORROW_SERVICE_ROLE`, `PORT`, and systemd service name. Keep them on
the same `SQLITE_DB_PATH` only while SQLite is still the production database;
at higher write volume, move the shared data layer to Postgres before splitting
the codebase further.

## First Deployment

After the secrets and variables are configured:

1. Merge the deployment pipeline pull request into `main`.
2. Open the `Deploy` workflow in the GitHub Actions tab.
3. Confirm the `Verify` job passes.
4. Confirm the `Deploy production` job restarts the service and reports a
   successful health check.

Manual deployments can be run from the `Actions` tab with `Run workflow` after
selecting the `main` branch.

## Health Checks

The deployment workflow checks `/api/health` by default. That endpoint verifies
the app can resolve its SQLite configuration and execute a trivial DB query.
Production still requires `SQLITE_DB_PATH`; local development and tests fall
back to `apps/web/.data/notomorrow-dev.db` if it is unset.
