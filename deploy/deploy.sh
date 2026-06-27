#!/usr/bin/env bash
#
# Release script for ZASS. Run as root after the one-time setup:
#   sudo bash /srv/zass/deploy/deploy.sh
#
# Pulls the latest code, installs deps, applies migrations, builds, and restarts
# the service. File-touching steps run as the service user so ownership stays
# correct; only systemctl runs as root.
set -euo pipefail

APP_USER=zass
APP_DIR=/srv/zass

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root (needs systemctl)." >&2
  exit 1
fi

cd "$APP_DIR"

echo "==> Pulling latest code"
# Skipped automatically if this isn't a git checkout (first manual upload).
if [ -d .git ]; then
  sudo -u "$APP_USER" git pull --ff-only
else
  echo "    (no .git here — assuming code was uploaded manually)"
fi

echo "==> Installing dependencies (incl. dev deps, needed to build)"
# Skip Puppeteer's bundled Chromium download — we use the system Chromium via
# PUPPETEER_EXECUTABLE_PATH. Saves ~150 MB and time on every deploy.
sudo -u "$APP_USER" env PUPPETEER_SKIP_DOWNLOAD=true npm ci

echo "==> Applying database migrations"
sudo -u "$APP_USER" npm run db:migrate:deploy

echo "==> Building (prisma generate + tsc)"
sudo -u "$APP_USER" npm run build

echo "==> Restarting service"
systemctl restart zass
sleep 2
systemctl --no-pager status zass | head -n 20

echo ""
echo "==> Deployed. Tail logs with: sudo journalctl -u zass -f"
