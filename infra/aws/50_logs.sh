#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh

LOG_GROUPS=(
  "/ohio-claims/${ENV_NAME}/claims-api"
  "/ohio-claims/${ENV_NAME}/openclaw"
)

echo "Creating CloudWatch log groups with 14-day retention..."
for lg in "${LOG_GROUPS[@]}"; do
  echo "  Creating: $lg"
  aws logs create-log-group \
    --log-group-name "$lg" \
    --region "$AWS_REGION" 2>/dev/null || true
  aws logs put-retention-policy \
    --log-group-name "$lg" \
    --retention-in-days 14 \
    --region "$AWS_REGION"
done
echo "Done."
