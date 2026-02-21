#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh
source .state/ids.env 2>/dev/null || true
source .state/iam.env 2>/dev/null || true

STATE_DIR="$SCRIPT_DIR/.state"
mkdir -p "$STATE_DIR"

SG_NAME="ohio-claims-${ENV_NAME}-sg"

echo "Looking up Ubuntu 22.04 AMI via SSM..."
AMI_ID=$(aws ssm get-parameters \
  --names "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id" \
  --query "Parameters[0].Value" \
  --output text \
  --region "$AWS_REGION")
echo "  AMI_ID=$AMI_ID"

echo "Creating security group: $SG_NAME"
CALLER_IP=$(curl -s https://checkip.amazonaws.com 2>/dev/null || echo "0.0.0.0/0")
SG_ID=$(aws ec2 create-security-group \
  --group-name "$SG_NAME" \
  --description "Ohio Claims dev - SSH and ${EDGE_PORT}" \
  --vpc-id "$VPC_ID" \
  --region "$AWS_REGION" \
  --output text \
  --query GroupId 2>/dev/null || aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
    --query "SecurityGroups[0].GroupId" \
    --output text \
    --region "$AWS_REGION")

echo "Adding SSH rule (from $CALLER_IP)..."
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 22 \
  --cidr "${CALLER_IP}/32" 2>/dev/null || true

echo "Adding port ${EDGE_PORT} rule (from anywhere)..."
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port "$EDGE_PORT" \
  --cidr "0.0.0.0/0" 2>/dev/null || true

echo "Checking for existing instance..."
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters \
    "Name=tag:Name,Values=ohio-claims-${ENV_NAME}" \
    "Name=tag:Project,Values=$PROJECT_SLUG" \
    "Name=instance-state-name,Values=pending,running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || true)

if [[ -z "${INSTANCE_ID:-}" || "$INSTANCE_ID" == "None" ]]; then
  echo "Launching new EC2 instance..."
  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type t3.micro \
    --subnet-id "$SUBNET_ID" \
    --security-group-ids "$SG_ID" \
    --iam-instance-profile Name="$PROFILE_NAME" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=ohio-claims-${ENV_NAME}},{Key=Project,Value=$PROJECT_SLUG},{Key=Environment,Value=$ENV_NAME}]" \
    --region "$AWS_REGION" \
    --query "Instances[0].InstanceId" \
    --output text)
else
  echo "Using existing instance: $INSTANCE_ID"
fi

echo "Waiting for instance $INSTANCE_ID to be running..."
aws ec2 wait instance-running \
  --instance-ids "$INSTANCE_ID" \
  --region "$AWS_REGION"

PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text \
  --region "$AWS_REGION")
echo "  PUBLIC_IP=$PUBLIC_IP"

STATE_FILE="$STATE_DIR/ec2.env"
{
  echo "INSTANCE_ID=$INSTANCE_ID"
  echo "PUBLIC_IP=$PUBLIC_IP"
  echo "SG_ID=$SG_ID"
} > "$STATE_FILE"
echo "Wrote $STATE_FILE"
