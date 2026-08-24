#!/usr/bin/env bash
# Update the running NoTomorrow web app on the droplet in-place.
#
#   git pull → pnpm install → migrations → build → systemctl restart → health check.
#
# Idempotent: no-ops when nothing changed. Safe to re-run.
# Run from anywhere as `deploy`:
#   bash ~/NoTomorrow/scripts/deploy.sh
#
# The typical invocation from your Mac:
#   ssh deploy@<droplet> 'cd ~/NoTomorrow && bash scripts/deploy.sh'

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$REPO_ROOT"

SERVICE=${SERVICE:-notomorrow.service}
ENV_FILE=${ENV_FILE:-"$REPO_ROOT/apps/web/.env.local"}
HEALTH_URL=${HEALTH_URL:-"http://127.0.0.1:3000/"}

# Cap Node heap for the 512 MB droplet build. Override with NODE_OPTIONS=... on
# larger hosts.
export NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=1024"}

step() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

step "git pull"
before=$(git rev-parse HEAD)
git pull --ff-only
after=$(git rev-parse HEAD)
if [ "$before" = "$after" ]; then
  echo "already at $after — nothing new to deploy"
else
  echo "$before → $after"
  git log --oneline "$before..$after" | sed 's/^/  /'
  # If the pull rewrote this script, bash is still reading the old bytes by
  # offset — the next steps can be skipped, duplicated, or run against a
  # half-old / half-new file. Re-exec against the new script contents. The
  # sentinel prevents infinite recursion; the re-execed run pulls again
  # (no-op, same HEAD), sees no change, and continues.
  if [ -z "${NT_DEPLOY_REEXEC:-}" ] && \
     git diff --name-only "$before" "$after" | grep -qx 'scripts/deploy.sh'; then
    echo "  scripts/deploy.sh changed in this pull — re-execing"
    export NT_DEPLOY_REEXEC=1
    exec bash "$0" "$@"
  fi
fi

step "pnpm install (frozen lockfile)"
# --frozen-lockfile is a fast no-op if pnpm-lock.yaml didn't change.
pnpm install --network-concurrency=4 --child-concurrency=2 --frozen-lockfile

step "prune pnpm store"
# The content-addressable store keeps every version of every package
# ever installed; on a 10 GB droplet that fills the disk in a handful
# of deploys and SQLite starts throwing "database or disk is full" on
# writes. Prune removes packages no longer referenced by any project
# in this workspace — safe post-install, since --frozen-lockfile has
# just re-linked everything we still need.
pnpm store prune

step "apply DB migrations"
# Read SQLITE_DB_PATH from the env file so we don't hardcode it here.
DB_PATH=$(grep -E '^SQLITE_DB_PATH=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)
if [ -z "$DB_PATH" ]; then
  fail "SQLITE_DB_PATH not found in $ENV_FILE"
fi
(
  cd "$REPO_ROOT/apps/web"
  DB_PATH="$DB_PATH" \
  MIGRATIONS_DIR="$REPO_ROOT/packages/db-sqlite/migrations" \
  node -e '
    const Database = require("better-sqlite3");
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    const { migrate } = require("drizzle-orm/better-sqlite3/migrator");
    const sqlite = new Database(process.env.DB_PATH);
    sqlite.pragma("foreign_keys = ON");
    migrate(drizzle(sqlite), { migrationsFolder: process.env.MIGRATIONS_DIR });
    sqlite.close();
    console.log("migrations OK →", process.env.DB_PATH);
  '
)

step "build"
pnpm --filter web build

step "stage standalone assets"
# next.config.ts sets output: 'standalone' so systemd runs
# .next/standalone/apps/web/server.js. The Next tracer copies node_modules
# but NOT .next/static or public/ — those must sit next to server.js or
# the standalone server 404s on every asset. Re-run on every deploy: build
# regenerates .next/standalone/ and wipes any staged copy from last time.
STANDALONE="$REPO_ROOT/apps/web/.next/standalone/apps/web"
rm -rf "$STANDALONE/.next/static" "$STANDALONE/public"
cp -r "$REPO_ROOT/apps/web/.next/static" "$STANDALONE/.next/static"
cp -r "$REPO_ROOT/apps/web/public" "$STANDALONE/public"

step "restart service"
sudo systemctl restart "$SERVICE"
sleep 3

step "health check"
if ! systemctl is-active --quiet "$SERVICE"; then
  fail "$SERVICE is not active — see: sudo journalctl -u $SERVICE -n 40"
fi
echo "  service: active"

if ! curl -sfI "$HEALTH_URL" >/dev/null; then
  fail "$HEALTH_URL did not return 2xx/3xx"
fi
echo "  http:    OK ($HEALTH_URL)"

printf '\n\033[1;32m✓\033[0m deployed %s\n' "$after"
