#!/usr/bin/env bash
# Start API + UI with matching ports for local dev.
# API: PORT=8080, UI proxy: API_TARGET=http://127.0.0.1:8080

set -e
API_PORT="${API_PORT:-8080}"
API_URL="http://127.0.0.1:${API_PORT}"

# Load secrets from AWS SSM if not already set
if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "Loading secrets from AWS SSM..."
  export OPENROUTER_API_KEY=$(aws ssm get-parameter --name "/ohio-claims/dev/OPENROUTER_API_KEY" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")
  export TELEGRAM_BOT_TOKEN=$(aws ssm get-parameter --name "/ohio-claims/dev/TELEGRAM_BOT_TOKEN" --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || echo "")
  export TELEGRAM_CHAT_ID=$(aws ssm get-parameter --name "/ohio-claims/dev/TELEGRAM_CHAT_ID" --query 'Parameter.Value' --output text 2>/dev/null || echo "")
  export SITE_URL="http://localhost:5173"
fi

echo "=== Ohio Claims Dev ==="
echo "API port: $API_PORT"
[ -n "$OPENROUTER_API_KEY" ] && echo "OpenRouter: configured" || echo "OpenRouter: NOT SET (pipeline will stall)"
[ -n "$TELEGRAM_BOT_TOKEN" ] && echo "Telegram: configured" || echo "Telegram: disabled"
echo ""

# Start API in background
cd "$(dirname "$0")/services/claims-api"
USE_MEMORY_STORAGE=true PORT="$API_PORT" HOST=127.0.0.1 \
  OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID" \
  npx tsx src/index.ts &
API_PID=$!
cd - > /dev/null

# Wait for API to be ready
echo "Waiting for API..."
for i in {1..30}; do
  if curl -sf "$API_URL/healthz" > /dev/null 2>&1; then
    echo "API ready at $API_URL"
    break
  fi
  if ! kill -0 $API_PID 2>/dev/null; then
    echo "API process exited"
    exit 1
  fi
  sleep 0.5
done

# Start UI with matching API target
cd "$(dirname "$0")/ui"
API_TARGET="$API_URL" npx vite --port 5173
# When vite exits, kill API
kill $API_PID 2>/dev/null || true
