#!/usr/bin/env bash
set -euo pipefail

echo "== Deploy (Ubuntu) with PM2 =="

# Ensure PM2 installed
if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 not found. Installing globally..."
  sudo npm i -g pm2
fi

export NODE_ENV=production
export PORT=${PORT:-3000}
echo "Using PORT=$PORT, NODE_ENV=$NODE_ENV"

# Install dependencies
if [ -f package-lock.json ]; then
  echo "Running npm ci..."
  npm ci
else
  echo "Running npm install..."
  npm install
fi

# Prisma migrations (optional if schema changed)
if [ -f prisma/schema.prisma ]; then
  echo "Applying Prisma migrations..."
  npx prisma migrate deploy
fi

echo "Building production..."
npm run build

echo "Starting app with PM2..."
pm2 start ecosystem.config.js || pm2 restart tailadmin --update-env
pm2 save

echo "To auto-start on boot, run:"
echo "  sudo env PATH=\"$PATH\" pm2 startup systemd -u $(whoami) --hp \"$HOME\""
echo "Then: pm2 save"