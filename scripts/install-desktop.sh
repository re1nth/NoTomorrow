#!/usr/bin/env bash
# Build, install, and launch the NoTomorrow desktop .app in one shot.
#
# - No Docker, no Postgres, no manual migrations: the launcher boots SQLite
#   and applies its own migrations at startup.
# - Idempotent: run this on first install and after every code change.
# - The build is unsigned, so we clear the macOS quarantine bit ourselves;
#   users never touch `xattr`.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer only supports macOS." >&2
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "This installer only supports Apple Silicon (arm64). Detected: $(uname -m)." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found on PATH. Install pnpm (>=9), then re-run." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

APP_NAME="NoTomorrow"
INSTALLED_APP="/Applications/${APP_NAME}.app"
BUILT_APP="apps/desktop/dist-electron/mac-arm64/${APP_NAME}.app"

echo "==> Quitting any running ${APP_NAME}"
osascript -e "tell application \"${APP_NAME}\" to quit" 2>/dev/null || true
for _ in $(seq 1 10); do
  pgrep -qif "${INSTALLED_APP}/Contents/MacOS/${APP_NAME}" || break
  sleep 0.5
done

echo "==> Building the desktop bundle (takes ~3 minutes)"
pnpm --filter desktop dist

if [[ ! -d "$BUILT_APP" ]]; then
  echo "Build finished but ${BUILT_APP} is missing." >&2
  exit 1
fi

echo "==> Installing to ${INSTALLED_APP}"
rm -rf "$INSTALLED_APP"
cp -R "$BUILT_APP" "$INSTALLED_APP"

echo "==> Clearing macOS quarantine (unsigned build)"
xattr -dr com.apple.quarantine "$INSTALLED_APP" 2>/dev/null || true

echo "==> Launching ${APP_NAME}"
open -a "$APP_NAME"

echo
echo "Done. ${APP_NAME} is installed and running."
echo "Data lives in ~/Library/Application Support/${APP_NAME}/"
