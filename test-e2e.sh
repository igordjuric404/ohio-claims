#!/usr/bin/env bash
set -euo pipefail

API="http://35.159.168.132:8080"
ADMIN_PW="${ADMIN_PASSWORD:-admin-dev-password}"

echo "=== Ohio Claims E2E Test ==="
echo "API: $API"
echo ""

# 1. Health check
echo "1. Health check..."
curl -sf "$API/healthz" | jq .
echo ""

# 2. Admin login
echo "2. Admin login..."
LOGIN_RESP=$(curl -sf -c /tmp/ohio-cookies -X POST "$API/admin/login" \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$ADMIN_PW\"}")
echo "$LOGIN_RESP" | jq .
echo ""

# 3. Cleanup stale runs
echo "3. Cleanup stale runs..."
curl -sf -b /tmp/ohio-cookies -X POST "$API/admin/runs/cleanup-stale" | jq .
echo ""

# 4. Seed agents
echo "4. Seed agents..."
curl -sf -b /tmp/ohio-cookies -X POST "$API/admin/agents/seed" | jq .
echo ""

# 5. Verify agents
echo "5. Verify agents..."
curl -sf -b /tmp/ohio-cookies "$API/admin/agents" | jq '.agents | length'
echo ""

# 6. Create a claim
echo "6. Creating claim..."
CLAIM_RESP=$(curl -sf -X POST "$API/edge/claims" \
  -H 'Content-Type: application/json' \
  -d '{
    "policy_id": "POL-TEST-E2E-001",
    "claimant": {
      "full_name": "Jane Thompson",
      "phone": "(614) 555-0199",
      "email": "jane.thompson@example.com",
      "address": "456 Oak Ave, Columbus, OH 43215"
    },
    "loss": {
      "date_of_loss": "2026-02-15",
      "city": "Columbus",
      "description": "Rear-ended at a red light on High Street. Minor bumper damage, cracked tail light. Other driver admitted fault."
    },
    "vehicle": {
      "vin": "5YJSA1E23LF123456",
      "year": 2022,
      "make": "Honda",
      "model": "Accord"
    }
  }')
echo "$CLAIM_RESP" | jq .
CLAIM_ID=$(echo "$CLAIM_RESP" | jq -r '.claim_id')
echo "Claim ID: $CLAIM_ID"
echo ""

# 7. Upload test images
echo "7. Uploading test images..."
IMG_DIR="$(dirname "$0")/test-images"
for img in "$IMG_DIR"/test{1,2,3}.jpg; do
  FNAME=$(basename "$img")
  echo "  Uploading $FNAME..."
  PRESIGN=$(curl -sf -X POST "$API/edge/claims/$CLAIM_ID/damage-photos/presign" \
    -H 'Content-Type: application/json' \
    -d "{\"filename\":\"$FNAME\",\"content_type\":\"image/jpeg\"}")
  UPLOAD_URL=$(echo "$PRESIGN" | jq -r '.upload_url')
  curl -sf -X PUT "$UPLOAD_URL" \
    -H 'Content-Type: image/jpeg' \
    --data-binary "@$img" > /dev/null
  echo "  Done: $FNAME"
done
echo ""

# 8. List photos
echo "8. Verify photos..."
curl -sf "$API/edge/claims/$CLAIM_ID/damage-photos" | jq '.photos | length'
echo ""

# 9. Run pipeline
echo "9. Running pipeline (this may take 20-60s)..."
PIPELINE_RESP=$(curl -sf --max-time 120 -X POST "$API/edge/claims/$CLAIM_ID/run")
echo "$PIPELINE_RESP" | jq '{final_stage, stages_completed, errors, run_ids: (.run_ids | length)}'
FINAL_STAGE=$(echo "$PIPELINE_RESP" | jq -r '.final_stage')
echo "Final stage: $FINAL_STAGE"
echo ""

# 10. Verify runs
echo "10. Verify runs for claim..."
RUNS_RESP=$(curl -sf -b /tmp/ohio-cookies "$API/admin/claims/$CLAIM_ID")
echo "$RUNS_RESP" | jq '{runs_count: (.runs | length), events_count: (.events | length), stage: .claim.stage}'
echo ""

# 11. Check a run detail
echo "11. Check first run detail..."
FIRST_RUN=$(echo "$RUNS_RESP" | jq -r '.runs[0].run_id // empty')
if [ -n "$FIRST_RUN" ]; then
  RUN_DETAIL=$(curl -sf -b /tmp/ohio-cookies "$API/admin/runs/$FIRST_RUN")
  echo "$RUN_DETAIL" | jq '{
    agent_id: .run.agent_id,
    status: .run.status,
    has_input: (.run.input_prompt != null),
    has_output: (.run.output_json != null),
    events_count: (.events | length),
    event_types: [.events[].event_type] | unique
  }'
else
  echo "  No runs found"
fi
echo ""

# 12. Overview
echo "12. Admin overview..."
curl -sf -b /tmp/ohio-cookies "$API/admin/overview" | jq '{total_claims, total_runs, total_tokens, agents: (.runs_by_agent | keys)}'
echo ""

# 13. Run assessment
echo "13. Running damage assessment..."
ASSESS_RESP=$(curl -sf --max-time 120 -X POST "$API/edge/claims/$CLAIM_ID/assess" 2>&1 || echo '{"error":"assessment failed or timed out"}')
echo "$ASSESS_RESP" | jq '{
  photos_analyzed,
  damage_count: (.detected_damage | length),
  parts_count: (.parts | length),
  estimate_range: .totals.estimate_range,
  total_loss: .total_loss.recommended,
  web_search_source: .web_search.pricing_source,
  citations_count: (.web_search.citations | length)
}' 2>/dev/null || echo "$ASSESS_RESP" | head -200
echo ""

echo "=== E2E Test Complete ==="
echo "Claim: $CLAIM_ID"
echo "Final Stage: $FINAL_STAGE"
