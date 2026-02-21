#!/usr/bin/env bash
# =============================================================================
# Tether — Production Deploy Script
# Usage: bash deploy.sh
# Pulls HEAD, builds frontend, installs backend deps, restarts via PM2
# =============================================================================
set -euo pipefail

# ──────────────────── CONFIGURATION ────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
PM2_APP_NAME="tether-backend"
BACKEND_URL="https://tether.drshumard.com"
LOG_DIR="/var/log/tether"

# ──────────────────── COLOURS ────────────────────
GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; CYAN="\033[0;36m"; BOLD="\033[1m"; RESET="\033[0m"
info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()      { echo -e "${GREEN}[✓ OK]${RESET}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
err_exit(){ echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }

echo -e "\n${BOLD}${CYAN}=========================================${RESET}"
echo -e "${BOLD}${CYAN}  Tether — Production Deploy${RESET}"
echo -e "${BOLD}${CYAN}  $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo -e "${BOLD}${CYAN}=========================================${RESET}\n"

# ──────────────────── PRE-FLIGHT CHECKS ────────────────────
info "Running pre-flight checks…"

command -v python3  &>/dev/null || err_exit "python3 not found"
command -v pm2      &>/dev/null || err_exit "pm2 not found  — install with: sudo npm i -g pm2"
command -v yarn     &>/dev/null || err_exit "yarn not found — install with: sudo npm i -g yarn"
command -v node     &>/dev/null || err_exit "node not found"
command -v git      &>/dev/null || err_exit "git not found"

# Verify backend .env exists and has required keys
ENV_FILE="$BACKEND_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env not found at $ENV_FILE"
  info "Creating from .env.example… (fill in MONGO_URL and DB_NAME before re-running)"
  cat > "$ENV_FILE" << 'ENVEOF'
MONGO_URL="mongodb://localhost:27017"
DB_NAME="tether_prod"
REACT_APP_BACKEND_URL="https://tether.drshumard.com"
ENVEOF
  err_exit "$ENV_FILE created with defaults. Edit it and re-run."
fi

for KEY in MONGO_URL DB_NAME REACT_APP_BACKEND_URL; do
  grep -q "^${KEY}" "$ENV_FILE" || err_exit "$KEY missing from $ENV_FILE"
done
ok "Pre-flight checks passed"

# Create log dir
sudo mkdir -p "$LOG_DIR"
sudo chown "$(whoami):$(whoami)" "$LOG_DIR" 2>/dev/null || true

# ──────────────────── 1. PULL LATEST CODE ────────────────────
echo -e "\n${BOLD}Step 1/4 — Pull latest code${RESET}"
cd "$APP_DIR"

CURRENT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
info "Current commit: $CURRENT_SHA"

git fetch origin
c    # hard reset to HEAD of main — discards local changes

NEW_SHA=$(git rev-parse --short HEAD)
if [[ "$CURRENT_SHA" == "$NEW_SHA" ]]; then
  info "Already up-to-date ($NEW_SHA) — still rebuilding frontend and restarting backend"
else
  ok "Updated $CURRENT_SHA → $NEW_SHA"
fi

# ──────────────────── 2. BACKEND ────────────────────
echo -e "\n${BOLD}Step 2/4 — Backend dependencies${RESET}"
cd "$BACKEND_DIR"

if [[ ! -d venv ]]; then
  info "Creating Python virtual environment…"
  python3 -m venv venv
  ok "venv created"
fi

source venv/bin/activate

info "Installing production Python packages…"
pip install --quiet --upgrade pip
pip install --quiet \
  "fastapi==0.110.1" \
  "uvicorn[standard]==0.25.0" \
  "motor==3.3.1" \
  "pymongo==4.5.0" \
  "python-dotenv==1.2.1" \
  "pydantic==2.12.5" \
  "httpx==0.28.1" \
  "python-multipart==0.0.22" \
  "starlette==0.37.2"

ok "Backend dependencies installed"

# Smoke-test: import the app without running it
info "Checking server.py imports cleanly…"
python3 -c "import server" && ok "server.py OK" || err_exit "server.py failed to import — check for syntax errors"

deactivate

# ──────────────────── 3. FRONTEND BUILD ────────────────────
echo -e "\n${BOLD}Step 3/4 — Frontend build${RESET}"
cd "$FRONTEND_DIR"

info "Installing JS dependencies (yarn install)…"
yarn install --frozen-lockfile --silent

info "Building React app (this takes ~60s)…"
CI=false yarn build          # CI=false so warnings don't abort the build

# Quick sanity check
[[ -f build/index.html ]] || err_exit "build/index.html missing — yarn build failed"
ok "Frontend built: $(du -sh build | cut -f1) in $FRONTEND_DIR/build"

# ──────────────────── 4. PM2 ────────────────────
echo -e "\n${BOLD}Step 4/4 — PM2 process management${RESET}"
cd "$APP_DIR"

if pm2 list | grep -q "$PM2_APP_NAME"; then
  info "Restarting existing PM2 process '$PM2_APP_NAME'…"
  pm2 restart "$PM2_APP_NAME"
else
  info "Starting PM2 process for the first time…"
  pm2 start ecosystem.config.js
fi

# Persist PM2 process list so it survives reboots
pm2 save
ok "PM2 process '$PM2_APP_NAME' is running"

# ──────────────────── DONE ────────────────────
sleep 2   # Give PM2 a moment to boot the process

echo -e "\n${BOLD}${GREEN}=========================================${RESET}"
echo -e "${BOLD}${GREEN}  Deploy complete!${RESET}"
echo -e "${BOLD}${GREEN}=========================================${RESET}"
echo -e ""
echo -e "  ${BOLD}App URL    ${RESET}  https://tether.drshumard.com"
echo -e "  ${BOLD}API health ${RESET}  https://tether.drshumard.com/api/"
echo -e "  ${BOLD}Script tag ${RESET}  <script src=\"https://tether.drshumard.com/api/shumard.js\"></script>"
echo -e ""
echo -e "  ${BOLD}PM2 status ${RESET}  pm2 status"
echo -e "  ${BOLD}Live logs  ${RESET}  pm2 logs tether-backend"
echo -e "  ${BOLD}Error logs ${RESET}  pm2 logs tether-backend --err"
echo -e ""

# Show final process status
pm2 show "$PM2_APP_NAME" | grep -E "status|uptime|memory|cpu|pid" || true
