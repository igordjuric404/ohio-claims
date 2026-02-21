#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
source env.sh

STATE_DIR="$SCRIPT_DIR/.state"

echo "=== Ohio Claims destroy - teardown ==="

# Source state files if they exist
[[ -f "$STATE_DIR/ids.env" ]] && source "$STATE_DIR/ids.env"
[[ -f "$STATE_DIR/ec2.env" ]] && source "$STATE_DIR/ec2.env"
[[ -f "$STATE_DIR/s3.env" ]] && source "$STATE_DIR/s3.env"
[[ -f "$STATE_DIR/ddb.env" ]] && source "$STATE_DIR/ddb.env"
[[ -f "$STATE_DIR/iam.env" ]] && source "$STATE_DIR/iam.env"

# Terminate EC2
if [[ -n "${INSTANCE_ID:-}" ]]; then
  echo "Terminating EC2 instance: $INSTANCE_ID"
  aws ec2 terminate-instances --instance-ids "$INSTANCE_ID" --region "$AWS_REGION" 2>/dev/null || true
  echo "  Waiting for termination..."
  aws ec2 wait instance-terminated --instance-ids "$INSTANCE_ID" --region "$AWS_REGION" 2>/dev/null || true
fi

# Delete security group
if [[ -n "${SG_ID:-}" ]]; then
  echo "Deleting security group: $SG_ID"
  sleep 5  # Allow SG to detach
  aws ec2 delete-security-group --group-id "$SG_ID" --region "$AWS_REGION" 2>/dev/null || true
fi

# Delete DynamoDB tables
for table in "${CLAIMS_TABLE:-}" "${EVENTS_TABLE:-}"; do
  if [[ -n "$table" ]]; then
    echo "Deleting DynamoDB table: $table"
    aws dynamodb delete-table --table-name "$table" --region "$AWS_REGION" 2>/dev/null || true
  fi
done

# Delete S3 bucket (empty first)
BUCKET_NAME="${BUCKET_NAME:-ohio-claims-${ENV_NAME}-attachments-${ACCOUNT_ID:-422287833706}-${AWS_REGION}}"
if [[ -n "$BUCKET_NAME" ]]; then
  echo "Emptying and deleting S3 bucket: $BUCKET_NAME"
  aws s3 rb "s3://$BUCKET_NAME" --force 2>/dev/null || true
fi

# Delete IAM instance profile and role
PROFILE_NAME="${PROFILE_NAME:-ohio-claims-${ENV_NAME}-ec2-profile}"
ROLE_NAME="${ROLE_NAME:-ohio-claims-${ENV_NAME}-ec2-role}"
if [[ -n "$PROFILE_NAME" ]]; then
  echo "Removing role from instance profile: $PROFILE_NAME"
  aws iam remove-role-from-instance-profile \
    --instance-profile-name "$PROFILE_NAME" \
    --role-name "$ROLE_NAME" 2>/dev/null || true
  echo "Deleting instance profile: $PROFILE_NAME"
  aws iam delete-instance-profile --instance-profile-name "$PROFILE_NAME" 2>/dev/null || true
fi
if [[ -n "$ROLE_NAME" ]]; then
  echo "Detaching policies and deleting role: $ROLE_NAME"
  aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "ohio-claims-${ENV_NAME}-ec2-inline" 2>/dev/null || true
  aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy" 2>/dev/null || true
  aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" 2>/dev/null || true
  aws iam delete-role --role-name "$ROLE_NAME" 2>/dev/null || true
fi

# Delete CloudWatch log groups
LOG_GROUPS=(
  "/ohio-claims/${ENV_NAME}/claims-api"
  "/ohio-claims/${ENV_NAME}/openclaw"
)
for lg in "${LOG_GROUPS[@]}"; do
  echo "Deleting log group: $lg"
  aws logs delete-log-group --log-group-name "$lg" --region "$AWS_REGION" 2>/dev/null || true
done

echo "Teardown complete. State files preserved in .state/"
