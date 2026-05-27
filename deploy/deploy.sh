#!/bin/bash
# Deploy Japan Customs API Hub on OpenCloudOS 9 / CentOS / RHEL
# Usage: chmod +x deploy.sh && ./deploy.sh
set -e

echo "============================================"
echo "  Japan Customs API Hub - Deploy"
echo "============================================"

# === CONFIGURE THIS ===
GIT_REPO="https://github.com/YOUR_USERNAME/YOUR_REPO.git"
APP_DIR="/opt/customs-api-hub"
# === END CONFIG ===

BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# 1. Node.js 20
echo ""
echo "[1/7] Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
fi
echo "  Node $(node -v)"

# 2. PM2
echo ""
echo "[2/7] PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
echo "  PM2 $(pm2 -v)"

# 3. Git clone / pull
echo ""
echo "[3/7] Code..."
if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR" && git pull
else
    sudo mkdir -p "$APP_DIR"
    sudo chown -R $USER:$USER /opt/customs-api-hub
    git clone "$GIT_REPO" "$APP_DIR"
fi

# 4. Backend
echo ""
echo "[4/7] Backend..."
cd "$BACKEND_DIR"
npm install
npm run build

# 5. Frontend
echo ""
echo "[5/7] Frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build

# 6. .env check
echo ""
echo "[6/7] Config..."
cd "$BACKEND_DIR"
if [ ! -f ".env" ]; then
    echo "  Creating .env from .env.example..."
    cp .env.example .env
    echo "  >>> IMPORTANT: edit .env with your API keys before starting!"
    echo "  >>> vim $BACKEND_DIR/.env"
fi

# 7. Start with PM2
echo ""
echo "[7/7] Starting..."
cd "$BACKEND_DIR"
pm2 delete customs-api-hub 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ""
echo "============================================"
echo "  Deploy complete!"
echo ""
echo "  Edit .env:    vim $BACKEND_DIR/.env"
echo "  Start:        pm2 start customs-api-hub"
echo "  Status:       pm2 status"
echo "  Logs:         pm2 logs customs-api-hub"
echo "  Access:       http://$(hostname -I | awk '{print $1}'):3000"
echo "============================================"
