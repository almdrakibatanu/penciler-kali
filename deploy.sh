#!/usr/bin/env bash
# One-shot deploy/update script for the VPS.
# Usage (from the repo root on the server):  bash deploy.sh
set -euo pipefail

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
npm install

echo "==> Building backend packages + API"
npm run build

echo "==> Building web app"
npm run build:web

echo "==> Initialising DB schema + syncing sources"
npm run seed

echo "==> Reloading PM2 processes"
pm2 reload ecosystem.config.cjs || pm2 start ecosystem.config.cjs
pm2 save

echo "==> Done. Check: pm2 status"
