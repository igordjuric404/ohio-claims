#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh

STATE_DIR="$SCRIPT_DIR/.state"
mkdir -p "$STATE_DIR"

echo "Discovering AWS account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)
if [[ -z "${ACCOUNT_ID:-}" ]]; then
  echo "ERROR: Could not get AWS account ID. Is AWS configured?"
  exit 1
fi
echo "  ACCOUNT_ID=$ACCOUNT_ID"

echo "Discovering default VPC..."
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=is-default,Values=true" \
  --query "Vpcs[0].VpcId" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || true)
if [[ -z "${VPC_ID:-}" || "$VPC_ID" == "None" ]]; then
  echo "ERROR: No default VPC found in $AWS_REGION"
  exit 1
fi
echo "  VPC_ID=$VPC_ID"

echo "Discovering default subnet..."
SUBNET_ID=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query "Subnets[0].SubnetId" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || true)
if [[ -z "${SUBNET_ID:-}" || "$SUBNET_ID" == "None" ]]; then
  echo "ERROR: No subnet found in default VPC"
  exit 1
fi
echo "  SUBNET_ID=$SUBNET_ID"

STATE_FILE="$STATE_DIR/ids.env"
{
  echo "ACCOUNT_ID=$ACCOUNT_ID"
  echo "VPC_ID=$VPC_ID"
  echo "SUBNET_ID=$SUBNET_ID"
} > "$STATE_FILE"
echo "Wrote $STATE_FILE"
