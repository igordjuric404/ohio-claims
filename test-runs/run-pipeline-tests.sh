#!/usr/bin/env bash
set -euo pipefail

API="${API_URL:-http://127.0.0.1:8090}"
OUT_DIR="$(dirname "$0")/outputs"
mkdir -p "$OUT_DIR"

echo "=== Ohio Claims Pipeline E2E Test Suite ==="
echo "API: $API"
echo "Output dir: $OUT_DIR"
echo ""

# Health check
echo "--- Health check ---"
curl -sf "$API/healthz" | jq . || { echo "FATAL: API not reachable"; exit 1; }
echo ""

# Seed agents
echo "--- Seeding agents ---"
ADMIN_COOKIE=$(curl -sf -D - -X POST "$API/admin/login" -H 'Content-Type: application/json' -d '{"password":"admin-dev-password"}' | grep -i 'set-cookie' | sed 's/.*admin_session=//;s/;.*//')
curl -sf -b "admin_session=$ADMIN_COOKIE" -X POST "$API/admin/agents/seed" | jq .
echo ""

run_claim() {
  local NAME="$1"
  local PAYLOAD="$2"
  local OUTPUT_FILE="$OUT_DIR/${NAME}.json"

  echo "=== Test Case: $NAME ==="
  echo "--- Creating claim ---"

  CLAIM_RESP=$(curl -sf -X POST "$API/edge/claims" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD")
  CLAIM_ID=$(echo "$CLAIM_RESP" | jq -r '.claim_id')
  echo "Claim ID: $CLAIM_ID"

  if [ -z "$CLAIM_ID" ] || [ "$CLAIM_ID" = "null" ]; then
    echo "FAILED: Could not create claim"
    echo "{\"test_case\": \"$NAME\", \"error\": \"claim_creation_failed\", \"response\": $CLAIM_RESP}" > "$OUTPUT_FILE"
    return 1
  fi

  echo "--- Running pipeline ---"
  PIPELINE_START=$(date +%s)
  PIPELINE_RESP=$(curl -sf --max-time 300 -X POST "$API/edge/claims/$CLAIM_ID/run" 2>&1) || {
    echo "Pipeline failed or timed out"
    PIPELINE_RESP="{\"error\": \"pipeline_timeout_or_error\"}"
  }
  PIPELINE_END=$(date +%s)
  PIPELINE_DURATION=$((PIPELINE_END - PIPELINE_START))
  echo "Pipeline duration: ${PIPELINE_DURATION}s"

  echo "--- Fetching claim detail ---"
  REVIEWER_COOKIE=$(curl -sf -D - -X POST "$API/reviewer/login" -H 'Content-Type: application/json' -d '{"password":"reviewer-dev-password"}' | grep -i 'set-cookie' | sed 's/.*admin_session=//;s/;.*//')
  DETAIL=$(curl -sf -b "admin_session=$REVIEWER_COOKIE" "$API/reviewer/claims/$CLAIM_ID")

  echo "--- Fetching events ---"
  EVENTS=$(curl -sf "$API/edge/claims/$CLAIM_ID" | jq '.events')

  # Compose full output
  jq -n \
    --arg name "$NAME" \
    --arg claim_id "$CLAIM_ID" \
    --argjson pipeline "$PIPELINE_RESP" \
    --argjson detail "$DETAIL" \
    --argjson events "$EVENTS" \
    --arg duration "${PIPELINE_DURATION}s" \
    '{
      test_case: $name,
      claim_id: $claim_id,
      pipeline_duration: $duration,
      pipeline_result: $pipeline,
      reviewer_detail: $detail,
      events: $events
    }' > "$OUTPUT_FILE"

  echo "Saved to $OUTPUT_FILE"
  FINAL_STAGE=$(echo "$PIPELINE_RESP" | jq -r '.final_stage // "unknown"')
  STAGES=$(echo "$PIPELINE_RESP" | jq -r '.stages_completed // [] | join(", ")')
  ERRORS=$(echo "$PIPELINE_RESP" | jq -r '.errors // [] | join("; ")')
  echo "Final stage: $FINAL_STAGE"
  echo "Stages completed: $STAGES"
  [ -n "$ERRORS" ] && [ "$ERRORS" != "" ] && echo "Errors: $ERRORS"
  echo ""
}

# ──────────────────────────────────────────────────────────
# TEST CASE 1: Standard valid claim (happy path)
# ──────────────────────────────────────────────────────────
run_claim "01_standard_valid" '{
  "policy_id": "POL-OH-2024-83921",
  "claimant": {
    "full_name": "Sarah Mitchell",
    "phone": "(614) 555-0237",
    "email": "sarah.mitchell@email.com",
    "address": "782 Maple Ridge Dr, Columbus, OH 43215"
  },
  "loss": {
    "date_of_loss": "2026-02-18",
    "city": "Columbus",
    "description": "Was driving eastbound on Broad Street when another vehicle ran a red light at the intersection of 4th Street and collided with the front-right quarter panel. Impact caused significant damage to the bumper, headlight assembly, and fender. Police report filed (CPD #2026-0215-4472). The other driver was cited for running the red light."
  },
  "vehicle": {
    "vin": "1HGCV1F34PA027839",
    "year": 2023,
    "make": "Honda",
    "model": "Accord"
  }
}'

# ──────────────────────────────────────────────────────────
# TEST CASE 2: Minimal valid claim (bare minimum fields)
# ──────────────────────────────────────────────────────────
run_claim "02_minimal_valid" '{
  "policy_id": "POL-MIN-001",
  "claimant": {
    "full_name": "John Doe",
    "phone": "555-0000"
  },
  "loss": {
    "date_of_loss": "2026-02-20",
    "description": "Rear-ended at a stoplight. Minor bumper damage."
  },
  "vehicle": {}
}'

# ──────────────────────────────────────────────────────────
# TEST CASE 3: High-value / potential total loss
# ──────────────────────────────────────────────────────────
run_claim "03_high_value_total_loss" '{
  "policy_id": "POL-OH-2025-44102",
  "claimant": {
    "full_name": "Robert Chen",
    "phone": "(330) 555-8812",
    "email": "r.chen@protonmail.com",
    "address": "1200 W Market St, Akron, OH 44313"
  },
  "loss": {
    "date_of_loss": "2026-02-15",
    "city": "Akron",
    "description": "Vehicle hydroplaned on I-77 during heavy rain, lost control, struck the concrete median at approximately 65mph, spun across two lanes and was hit by a second vehicle on the driver side. Air bags deployed. Vehicle towed by State Highway Patrol. Extensive front-end, driver-side, and undercarriage damage. Frame appears bent. Vehicle is likely a total loss."
  },
  "vehicle": {
    "vin": "5YJSA1E23LF000001",
    "year": 2020,
    "make": "Tesla",
    "model": "Model S"
  }
}'

# ──────────────────────────────────────────────────────────
# TEST CASE 4: Suspicious / fraud indicators
# ──────────────────────────────────────────────────────────
run_claim "04_fraud_indicators" '{
  "policy_id": "POL-OH-2026-00199",
  "claimant": {
    "full_name": "Mike Johnson",
    "phone": "(216) 555-0001",
    "address": "PO Box 9999, Cleveland, OH 44101"
  },
  "loss": {
    "date_of_loss": "2026-02-19",
    "city": "Cleveland",
    "description": "Vehicle was parked overnight and found with extensive damage to all four panels, hood, and roof. No witnesses. No police report filed. Claimant states they do not know what happened. Vehicle was purchased 2 weeks ago. Claimant requests immediate cash settlement."
  },
  "vehicle": {
    "vin": "WVWZZZ3CZWE000001",
    "year": 2024,
    "make": "Volkswagen",
    "model": "ID.4"
  }
}'

# ──────────────────────────────────────────────────────────
# TEST CASE 5: Incomplete / conflicting data
# ──────────────────────────────────────────────────────────
run_claim "05_incomplete_conflicting" '{
  "policy_id": "",
  "claimant": {
    "full_name": "Jane Smith",
    "phone": "not-a-phone"
  },
  "loss": {
    "date_of_loss": "2030-01-01",
    "city": "",
    "description": "Minor scratch"
  },
  "vehicle": {
    "year": 1850,
    "make": "",
    "model": ""
  }
}'

echo "=== All test cases complete ==="
echo "Results saved in: $OUT_DIR/"
ls -la "$OUT_DIR/"
