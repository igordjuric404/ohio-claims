#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://35.159.168.132:8080}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin-dev-password}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CASES_FILE="$SCRIPT_DIR/cases.json"
IMAGES_DIR="$SCRIPT_DIR/images"

VERSION="${1:-v$(date +%Y%m%d_%H%M%S)}"
OUTPUT_DIR="$SCRIPT_DIR/results/$VERSION"
mkdir -p "$OUTPUT_DIR"

echo "=== Ohio Claims Pipeline Test Runner ==="
echo "API: $API_BASE"
echo "Version: $VERSION"
echo "Output: $OUTPUT_DIR"
echo ""

echo "[Health] Checking API..."
HEALTH=$(curl -s "$API_BASE/healthz" 2>&1) || true
echo "[Health] $HEALTH"
echo ""

TOTAL=$(python3 -c "import json; print(len(json.load(open('$CASES_FILE'))))")
echo "[Cases] $TOTAL test cases loaded"
echo ""

PASS=0
FAIL=0
ERROR=0

for i in $(seq 0 $((TOTAL - 1))); do
  CASE_ID=$(python3 -c "import json; c=json.load(open('$CASES_FILE'))[$i]; print(c['id'])")
  CASE_NAME=$(python3 -c "import json; c=json.load(open('$CASES_FILE'))[$i]; print(c['name'])")
  HAS_IMAGE=$(python3 -c "import json; c=json.load(open('$CASES_FILE'))[$i]; print(str(c.get('has_image',False)).lower())")
  IMAGE_FILE=$(python3 -c "import json; c=json.load(open('$CASES_FILE'))[$i]; print(c.get('image_file',''))")
  IMAGE_CT=$(python3 -c "import json; c=json.load(open('$CASES_FILE'))[$i]; print(c.get('image_content_type','image/jpeg'))")

  echo "--- [$CASE_ID] $CASE_NAME ---"

  CLAIM_JSON=$(python3 -c "import json,sys; c=json.load(open('$CASES_FILE'))[$i]; json.dump(c['claim'],sys.stdout)")

  CREATE_RESP=$(curl -s -X POST "$API_BASE/edge/claims" \
    -H "Content-Type: application/json" \
    -d "$CLAIM_JSON" 2>&1)

  CLAIM_ID_CREATED=$(echo "$CREATE_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('claim_id','ERROR'))" 2>/dev/null || echo "ERROR")

  if [ "$CLAIM_ID_CREATED" = "ERROR" ]; then
    echo "  [ERROR] Failed to create claim: $CREATE_RESP"
    echo "{\"case_id\":\"$CASE_ID\",\"error\":\"create_failed\"}" > "$OUTPUT_DIR/$CASE_ID.json"
    ERROR=$((ERROR + 1))
    echo ""
    continue
  fi
  echo "  [Created] $CLAIM_ID_CREATED"

  if [ "$HAS_IMAGE" = "true" ] && [ -n "$IMAGE_FILE" ] && [ -f "$IMAGES_DIR/$IMAGE_FILE" ]; then
    echo "  [Image] Uploading $IMAGE_FILE ($IMAGE_CT)..."
    PRESIGN_RESP=$(curl -s -X POST "$API_BASE/edge/claims/$CLAIM_ID_CREATED/damage-photos/presign" \
      -H "Content-Type: application/json" \
      -d "{\"filename\":\"$IMAGE_FILE\",\"content_type\":\"$IMAGE_CT\"}" 2>&1) || true
    UPLOAD_URL=$(echo "$PRESIGN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('upload_url',''))" 2>/dev/null || echo "")
    if [ -n "$UPLOAD_URL" ]; then
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$UPLOAD_URL" \
        -H "Content-Type: $IMAGE_CT" \
        --data-binary "@$IMAGES_DIR/$IMAGE_FILE" 2>&1) || true
      echo "  [Image] Upload status: $HTTP_CODE"
    else
      echo "  [Image] Presign failed"
    fi
  fi

  echo "  [Pipeline] Running all agents..."
  PIPELINE_RESP_FILE="$OUTPUT_DIR/${CASE_ID}_pipeline.json"
  curl -s --max-time 180 -X POST "$API_BASE/edge/claims/$CLAIM_ID_CREATED/run" \
    -o "$PIPELINE_RESP_FILE" 2>&1

  python3 -c "
import json, sys
case_id = '$CASE_ID'
case_name = '''$CASE_NAME'''
claim_id = '$CLAIM_ID_CREATED'
has_image = '$HAS_IMAGE' == 'true'
pf = '$PIPELINE_RESP_FILE'

try:
    with open(pf) as f:
        d = json.load(f)
except:
    d = {}

final_stage = d.get('final_stage', 'PARSE_ERROR')
stages = d.get('stages_completed', [])
errors = d.get('errors', [])
run_ids = d.get('run_ids', [])

outcome = 'unknown'
if final_stage == 'PAID': outcome = 'approved'
elif final_stage == 'CLOSED_NO_PAY': outcome = 'denied'
elif final_stage == 'FINAL_DECISION_DONE': outcome = 'decided'
elif 'DONE' in final_stage: outcome = 'partial'

result = {
    'case_id': case_id,
    'case_name': case_name,
    'claim_id': claim_id,
    'actual_outcome': outcome,
    'final_stage': final_stage,
    'stages_completed': stages,
    'num_stages': len(stages),
    'errors': errors,
    'run_ids': run_ids,
    'has_image': has_image
}
json.dump(result, open(f'$OUTPUT_DIR/{case_id}.json', 'w'), indent=2)

status = 'OK' if not errors else 'ISSUE'
print(f'  [{status}] Final: {final_stage} | Outcome: {outcome} | Stages: {len(stages)} agents')
if errors:
    for e in errors:
        print(f'  [Error] {e[:120]}')
if len(stages) < 5 and not errors:
    print(f'  [WARN] Only {len(stages)} stages completed (expected 5-6)')
" 2>&1

  echo ""
done

echo "========================================="
echo "  SUMMARY: $PASS ok, $FAIL issues, $ERROR errors (out of $TOTAL)"
echo "========================================="

python3 -c "
import json, os, glob

results = []
for f in sorted(glob.glob('$OUTPUT_DIR/TC*.json')):
    if f.endswith('_pipeline.json'):
        continue
    with open(f) as fh:
        results.append(json.load(fh))

outcomes = {}
for r in results:
    o = r.get('actual_outcome', 'unknown')
    outcomes[o] = outcomes.get(o, 0) + 1

avg_stages = sum(r.get('num_stages', 0) for r in results) / max(len(results), 1)
with_images = sum(1 for r in results if r.get('has_image'))

summary = {
    'version': '$VERSION',
    'total': len(results),
    'completed_ok': sum(1 for r in results if not r.get('errors')),
    'with_errors': sum(1 for r in results if r.get('errors')),
    'outcomes': outcomes,
    'avg_stages_completed': round(avg_stages, 1),
    'with_images': with_images,
    'results': results
}
json.dump(summary, open('$OUTPUT_DIR/summary.json', 'w'), indent=2)
print(f'Summary saved to $OUTPUT_DIR/summary.json')
print(f'Outcomes: {outcomes}')
print(f'Avg stages: {avg_stages:.1f}')
" 2>/dev/null || echo "[WARN] Could not generate summary"

echo "Results in: $OUTPUT_DIR"
