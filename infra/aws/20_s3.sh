#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh
source .state/ids.env 2>/dev/null || true

STATE_DIR="$SCRIPT_DIR/.state"
mkdir -p "$STATE_DIR"

BUCKET_NAME="ohio-claims-${ENV_NAME}-attachments-${ACCOUNT_ID:-422287833706}-${AWS_REGION}"

echo "Creating S3 bucket: $BUCKET_NAME"
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION" 2>/dev/null || true

echo "Applying CORS configuration..."
aws s3api put-bucket-cors \
  --bucket "$BUCKET_NAME" \
  --cors-configuration file://"$SCRIPT_DIR/data/s3-cors.json"

echo "Applying lifecycle configuration..."
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET_NAME" \
  --lifecycle-configuration file://"$SCRIPT_DIR/data/s3-lifecycle.json"

STATE_FILE="$STATE_DIR/s3.env"
{
  echo "BUCKET_NAME=$BUCKET_NAME"
} > "$STATE_FILE"
echo "Wrote $STATE_FILE"
