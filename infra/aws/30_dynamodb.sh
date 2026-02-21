#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh

STATE_DIR="$SCRIPT_DIR/.state"
mkdir -p "$STATE_DIR"

CLAIMS_TABLE="ohio-claims-${ENV_NAME}-Claims"
EVENTS_TABLE="ohio-claims-${ENV_NAME}-ClaimEvents"

echo "Creating DynamoDB table: $CLAIMS_TABLE"
aws dynamodb create-table \
  --table-name "$CLAIMS_TABLE" \
  --attribute-definitions AttributeName=claim_id,AttributeType=S \
  --key-schema AttributeName=claim_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$AWS_REGION" 2>/dev/null || true

echo "Creating DynamoDB table: $EVENTS_TABLE"
aws dynamodb create-table \
  --table-name "$EVENTS_TABLE" \
  --attribute-definitions \
    AttributeName=claim_id,AttributeType=S \
    AttributeName=event_sk,AttributeType=S \
  --key-schema \
    AttributeName=claim_id,KeyType=HASH \
    AttributeName=event_sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region "$AWS_REGION" 2>/dev/null || true

STATE_FILE="$STATE_DIR/ddb.env"
{
  echo "CLAIMS_TABLE=$CLAIMS_TABLE"
  echo "EVENTS_TABLE=$EVENTS_TABLE"
} > "$STATE_FILE"
echo "Wrote $STATE_FILE"
