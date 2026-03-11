#!/usr/bin/env bash
# =============================================================================
# HRMS – Pre-deployment check script
# Run this LOCALLY before pushing to main to catch issues early.
# Usage: bash scripts/pre-deploy-check.sh
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
PASS=0; FAIL=0

pass() { echo -e "  ${GREEN}✔${NC} $*"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${NC} $*"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; }
section() { echo -e "\n${BOLD}── $* ──${NC}"; }

echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  HRMS Pre-Deployment Check               ${NC}"
echo -e "${BOLD}============================================${NC}"

# ─── Node & npm versions ──────────────────────────────────────────────────────
section "Runtime"
NODE_VER=$(node -v 2>/dev/null | tr -d 'v' || echo "0")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -ge 20 ]; then
  pass "Node.js v$NODE_VER (>= 20 required)"
else
  fail "Node.js v$NODE_VER is too old – need 20+"
fi

NPM_VER=$(npm -v 2>/dev/null || echo "0")
pass "npm v$NPM_VER"

# ─── Required files ───────────────────────────────────────────────────────────
section "Required files"
for f in \
  "$BACKEND_DIR/.env" \
  "$BACKEND_DIR/prisma/schema.prisma" \
  "$FRONTEND_DIR/.env"
do
  if [ -f "$f" ]; then
    pass "$f"
  else
    fail "$f is MISSING"
  fi
done

# ─── Backend env vars ─────────────────────────────────────────────────────────
section "Backend environment variables"
if [ -f "$BACKEND_DIR/.env" ]; then
  source "$BACKEND_DIR/.env" 2>/dev/null || true
  REQUIRED_VARS=(
    DATABASE_URL
    JWT_SECRET
    REDIS_URL
    NODE_ENV
    PORT
    CORS_ORIGIN
  )
  for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
    if [ -n "$val" ]; then
      # Mask secrets in output
      if [[ "$var" == *SECRET* ]] || [[ "$var" == *PASSWORD* ]] || [[ "$var" == DATABASE_URL ]]; then
        pass "$var = ***masked***"
      else
        pass "$var = $val"
      fi
    else
      fail "$var is not set in backend/.env"
    fi
  done
  # Warn about defaults that should be changed
  if [[ "${JWT_SECRET:-}" == *"change-this"* ]]; then
    fail "JWT_SECRET still has default value – change it for production!"
  fi
  if [[ "${NODE_ENV:-}" != "production" ]]; then
    warn "NODE_ENV=$NODE_ENV – set to 'production' on the server"
  fi
fi

# ─── Backend: TypeScript compile ──────────────────────────────────────────────
section "Backend build"
echo "  Installing backend deps..."
cd "$BACKEND_DIR"
npm ci --silent 2>/dev/null || npm install --silent 2>/dev/null
npx prisma generate --silent 2>/dev/null || true

echo "  Running TypeScript compile check..."
if npx tsc --noEmit 2>&1 | tail -5; then
  pass "TypeScript compiles without errors"
else
  fail "TypeScript compile failed (see above)"
fi

echo "  Building backend..."
if npm run build > /dev/null 2>&1; then
  pass "Backend built successfully → dist/"
else
  fail "Backend build failed"
fi

# ─── Backend: Tests ───────────────────────────────────────────────────────────
section "Backend tests"
echo "  Running Jest tests..."
if npm test -- --passWithNoTests --forceExit --silent 2>/dev/null; then
  pass "All tests passed"
else
  warn "Some tests failed (check output above) – fix before deploying"
  ((FAIL++))
fi

# ─── Frontend build ───────────────────────────────────────────────────────────
section "Frontend build"
cd "$FRONTEND_DIR"
echo "  Installing frontend deps..."
npm ci --silent 2>/dev/null || npm install --silent 2>/dev/null

echo "  Building frontend (Vite)..."
if npm run build > /dev/null 2>&1; then
  DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1 || echo "?")
  pass "Frontend built successfully → dist/ ($DIST_SIZE)"
else
  fail "Frontend build failed"
fi

# ─── Git status ───────────────────────────────────────────────────────────────
section "Git status"
cd "$ROOT_DIR"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')

if [ "$BRANCH" = "main" ]; then
  pass "On branch: main"
else
  warn "On branch: $BRANCH – you will need to merge to main to trigger deploy"
fi

if [ "$UNCOMMITTED" = "0" ]; then
  pass "Working tree is clean (no uncommitted changes)"
else
  warn "$UNCOMMITTED uncommitted file(s) – they will NOT be deployed"
  git status --short
fi

UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNPUSHED" = "0" ]; then
  pass "All commits pushed to origin/main"
else
  warn "$UNPUSHED commit(s) not yet pushed to origin/main"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "  ${GREEN}PASSED: $PASS${NC}   ${RED}FAILED: $FAIL${NC}"
echo -e "${BOLD}============================================${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Fix the failures above before deploying.${NC}"
  exit 1
else
  echo -e "${GREEN}All checks passed – ready to deploy!${NC}"
  echo ""
  echo "  Push to main to trigger GitHub Actions deploy:"
  echo "    git push origin main"
fi
