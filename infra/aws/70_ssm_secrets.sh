#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh

PREFIX="/ohio-claims/${ENV_NAME}"

echo "Putting SSM SecureString parameters..."

OPENROUTER_KEY="${OPENROUTER_API_KEY:-}"
if [[ -n "$OPENROUTER_KEY" ]]; then
  echo "  /ohio-claims/dev/OPENROUTER_API_KEY"
  aws ssm put-parameter \
    --name "${PREFIX}/OPENROUTER_API_KEY" \
    --value "$OPENROUTER_KEY" \
    --type SecureString \
    --overwrite \
    --region "$AWS_REGION"
else
  echo "  WARN: OPENROUTER_API_KEY env var not set, skipping"
fi

APP_MASTER_KEY="${APP_MASTER_KEY_B64:-}"
if [[ -z "$APP_MASTER_KEY" ]]; then
  APP_MASTER_KEY=$(openssl rand -base64 32)
  echo "  Generated APP_MASTER_KEY_B64"
fi
echo "  ${PREFIX}/APP_MASTER_KEY_B64"
aws ssm put-parameter \
  --name "${PREFIX}/APP_MASTER_KEY_B64" \
  --value "$APP_MASTER_KEY" \
  --type SecureString \
  --overwrite \
  --region "$AWS_REGION"

OPENCLAW_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"
if [[ -z "$OPENCLAW_TOKEN" ]]; then
  OPENCLAW_TOKEN=$(openssl rand -hex 32)
  echo "  Generated OPENCLAW_GATEWAY_TOKEN"
fi
echo "  ${PREFIX}/OPENCLAW_GATEWAY_TOKEN"
aws ssm put-parameter \
  --name "${PREFIX}/OPENCLAW_GATEWAY_TOKEN" \
  --value "$OPENCLAW_TOKEN" \
  --type SecureString \
  --overwrite \
  --region "$AWS_REGION"

ADMIN_PW="${ADMIN_PASSWORD:-admin}"
echo "  ${PREFIX}/ADMIN_PASSWORD"
aws ssm put-parameter \
  --name "${PREFIX}/ADMIN_PASSWORD" \
  --value "$ADMIN_PW" \
  --type SecureString \
  --overwrite \
  --region "$AWS_REGION"

REVIEWER_PW="${REVIEWER_PASSWORD:-reviewer}"
echo "  ${PREFIX}/REVIEWER_PASSWORD"
aws ssm put-parameter \
  --name "${PREFIX}/REVIEWER_PASSWORD" \
  --value "$REVIEWER_PW" \
  --type SecureString \
  --overwrite \
  --region "$AWS_REGION"

echo "Done."
