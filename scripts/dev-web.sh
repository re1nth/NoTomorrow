#!/usr/bin/env bash
# Bring up everything needed for local web dev in one command:
#   1. .env exists (copied from .env.example on first run)
#   2. Postgres is running via docker-compose
#   3. Migrations are applied
#   4. `next dev` is serving on http://localhost:3000
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found on PATH. Install pnpm (>=9), then re-run." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Install Docker Desktop from https://docker.com and re-run." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
fi

echo "==> Ensuring Postgres is running (docker compose)"
docker compose up -d postgres

echo "==> Waiting for Postgres to accept connections"
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U notomorrow >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Applying migrations"
pnpm --filter @notomorrow/db migrate

echo "==> Starting Next dev server on http://localhost:3000"
exec pnpm --filter web dev
