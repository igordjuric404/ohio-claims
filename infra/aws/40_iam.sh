#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh

STATE_DIR="$SCRIPT_DIR/.state"
mkdir -p "$STATE_DIR"

ROLE_NAME="ohio-claims-${ENV_NAME}-ec2-role"
PROFILE_NAME="ohio-claims-${ENV_NAME}-ec2-profile"

echo "Creating IAM role: $ROLE_NAME"
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file://"$SCRIPT_DIR/policies/ec2-trust.json" 2>/dev/null || true

echo "Attaching CloudWatchAgentServerPolicy..."
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy" 2>/dev/null || true

echo "Attaching AmazonSSMManagedInstanceCore..."
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" 2>/dev/null || true

echo "Putting inline policy for DynamoDB, S3, SSM, KMS..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "ohio-claims-${ENV_NAME}-ec2-inline" \
  --policy-document file://"$SCRIPT_DIR/policies/ec2-inline-policy.json"

echo "Creating instance profile: $PROFILE_NAME"
aws iam create-instance-profile \
  --instance-profile-name "$PROFILE_NAME" 2>/dev/null || true

echo "Adding role to instance profile..."
aws iam add-role-to-instance-profile \
  --instance-profile-name "$PROFILE_NAME" \
  --role-name "$ROLE_NAME" 2>/dev/null || true

# Allow IAM propagation
echo "Waiting 10s for IAM propagation..."
sleep 10

STATE_FILE="$STATE_DIR/iam.env"
{
  echo "ROLE_NAME=$ROLE_NAME"
  echo "PROFILE_NAME=$PROFILE_NAME"
} > "$STATE_FILE"
echo "Wrote $STATE_FILE"
