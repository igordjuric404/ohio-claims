#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/env.sh"
source "$(dirname "$0")/.state/ec2.env"
source "$(dirname "$0")/.state/s3.env"
source "$(dirname "$0")/.state/ddb.env" 2>/dev/null || true

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_USER="ubuntu"
SSH_HOST="$PUBLIC_IP"

echo "=== Deploying to EC2: $SSH_HOST ==="

echo "1. Syncing project files to EC2..."
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '.wrangler' \
  --exclude '.openclaw' \
  --exclude 'infra/aws/.state' \
  -e "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10" \
  "$REPO_ROOT/" "${SSH_USER}@${SSH_HOST}:/home/ubuntu/ohio-claims/"

echo "2. Running setup on EC2..."
ssh -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" bash -s <<'REMOTE_SCRIPT'
set -euo pipefail

echo "Installing Node.js 22..."
if ! command -v node &>/dev/null || [[ "$(node --version)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version
npm --version

echo "Installing pnpm..."
sudo npm install -g pnpm@latest || true
pnpm --version

echo "Installing project dependencies..."
cd /home/ubuntu/ohio-claims
pnpm install --no-frozen-lockfile 2>&1 | tail -5

echo "Fetching secrets from SSM..."
export AWS_REGION="eu-central-1"
OPENROUTER_API_KEY=$(aws ssm get-parameter --name "/ohio-claims/dev/OPENROUTER_API_KEY" --with-decryption --query 'Parameter.Value' --output text)
APP_MASTER_KEY_B64=$(aws ssm get-parameter --name "/ohio-claims/dev/APP_MASTER_KEY_B64" --with-decryption --query 'Parameter.Value' --output text)
OPENCLAW_GATEWAY_TOKEN=$(aws ssm get-parameter --name "/ohio-claims/dev/OPENCLAW_GATEWAY_TOKEN" --with-decryption --query 'Parameter.Value' --output text)

echo "Writing environment file..."
sudo mkdir -p /etc/ohio-claims
sudo tee /etc/ohio-claims/env >/dev/null <<EOF
PORT=8080
HOST=0.0.0.0
AWS_REGION=eu-central-1
DDB_CLAIMS_TABLE=ohio-claims-dev-Claims
DDB_EVENTS_TABLE=ohio-claims-dev-ClaimEvents
S3_BUCKET=ohio-claims-dev-attachments-422287833706-eu-central-1
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
APP_MASTER_KEY_B64=${APP_MASTER_KEY_B64}
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
EOF
sudo chmod 600 /etc/ohio-claims/env

echo "Creating systemd service..."
sudo tee /etc/systemd/system/claims-api.service >/dev/null <<'UNIT'
[Unit]
Description=Ohio Claims API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ohio-claims/services/claims-api
EnvironmentFile=/etc/ohio-claims/env
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable claims-api
sudo systemctl restart claims-api

sleep 3
echo "Service status:"
sudo systemctl status claims-api --no-pager -l || true

echo "Testing healthz..."
curl -sS http://127.0.0.1:8080/healthz || echo "healthz failed"

echo "=== EC2 deployment complete ==="
REMOTE_SCRIPT

echo ""
echo "Testing from local machine..."
curl -sS "http://${SSH_HOST}:8080/healthz" && echo " <- healthz OK" || echo "healthz from local failed"
