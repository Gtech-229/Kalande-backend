#!/usr/bin/env bash
#
# One-time server setup for ZASS on Debian 13 (Trixie). Run ONCE as root:
#   bash deploy/setup-server.sh
#
# Installs Node 20, Chromium (for whatsapp-web.js), nginx, certbot, git, and
# creates the service user + app directory. Idempotent — safe to re-run.
set -euo pipefail

APP_USER=zass
APP_DIR=/srv/zass

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root." >&2
  exit 1
fi

echo "==> Updating apt"
apt-get update && apt-get upgrade -y

echo "==> Installing Node.js 20 (NodeSource)"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> Installing Chromium, nginx, certbot, git"
# The chromium package pulls in every shared library Chromium needs, so
# whatsapp-web.js can launch its browser.
apt-get install -y chromium nginx certbot python3-certbot-nginx git

echo "==> Creating service user '$APP_USER' and app dir '$APP_DIR'"
id -u "$APP_USER" >/dev/null 2>&1 || \
  useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

echo ""
echo "==> Done. Next steps (see DEPLOYMENT.md):"
echo "    1. Put the code in $APP_DIR (git clone as $APP_USER, or rsync)."
echo "    2. Create $APP_DIR/.env (chmod 600), based on .env.example."
echo "    3. Install the systemd unit + nginx config, then run deploy/deploy.sh."
echo "    Node:     $(node -v)"
echo "    Chromium: $(command -v chromium || echo 'not found')"
