#!/usr/bin/env bash
# =============================================================================
# HRMS – Server-side deploy script
# Runs on EC2 after GitHub Actions pushes code / rsync's frontend build.
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/hrms}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIST="$APP_DIR/frontend/dist"
NGINX_DIST="/var/www/hrms-frontend"   # where nginx serves static files

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $*"; }
error() { echo -e "${RED}[deploy]${NC} $*"; exit 1; }

# ─── 1. Pull latest code ───────────────────────────────────────────────────────
info "Pulling latest code from main..."
cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main

# ─── 2. Backend: install → generate → migrate → build ──────────────────────────
info "Installing backend dependencies..."
cd "$BACKEND_DIR"
npm ci --omit=dev=false   # install all (devDeps needed for tsc)

info "Generating Prisma client..."
npx prisma generate

info "Running database migrations..."
npx prisma migrate deploy   # safe for production (no data loss)

info "Building backend (TypeScript → JavaScript)..."
npm run build

# ─── 3. Sync frontend build to nginx root ──────────────────────────────────────
info "Deploying frontend build to nginx root..."
sudo mkdir -p "$NGINX_DIST"
sudo rsync -az --delete "$FRONTEND_DIST/" "$NGINX_DIST/"
sudo chown -R www-data:www-data "$NGINX_DIST"

# ─── 4. Restart backend with PM2 ──────────────────────────────────────────────
info "Restarting backend with PM2..."
cd "$APP_DIR"
if pm2 describe hrms-backend > /dev/null 2>&1; then
  pm2 reload hrms-backend --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

# ─── 5. Reload nginx ──────────────────────────────────────────────────────────
info "Reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

info "Deployment complete!"
echo ""
echo "  Backend  → PM2 process 'hrms-backend'"
echo "  Frontend → $NGINX_DIST"
echo ""
