# Execution Log — Features & Issues v2

## Phase Overview

| Phase | Name | Goal | Status |
|-------|------|------|--------|
| 1 | Database Clean Slate | Purge all claims and runs | Done |
| 2 | Stage Stepper + Decision Fix | Fix stepper, decision, stage labels | Done |
| 3 | Friendly Display Names | Human-friendly names across UI | Done |
| 4 | Content Overflow & Copy | Truncate + copy buttons | Done |
| 5 | Table Layout & Sorting | Column sizing + sort | Done |
| 6 | UI Polish | Agent name, pipeline button, placeholder | Done |
| 7 | Audit Explorer Overhaul | Better layout, fix empty fields | Done |
| 8 | Routing Fix | Back button navigation | Done |
| 9 | Assessor Web Search Evidence | Search evidence UI in run detail | Done |
| 10 | Test Cases & Runner | 30 cases + runner + comparison page | Done |

---

## Phase 1: Database Clean Slate (Issue #1)

### Checklist
- [x] 1.1 Add `DELETE /admin/claims/purge-all` endpoint (batch-deletes all claims + events)
- [x] 1.2 Add `DELETE /admin/runs/purge-all` endpoint (batch-deletes all runs + run events)
- [x] 1.3 Add `purgeAllClaims()` and `purgeAllRuns()` frontend API functions
- [x] 1.4 Verified: purge correctly removes all data

### Files Modified
- `services/claims-api/src/storage/dynamo.ts` — Added `BatchWriteCommand`, `DeleteCommand` imports; added `batchDeleteAll()`, `purgeAllClaims()`, `purgeAllRuns()` functions
- `services/claims-api/src/storage/memory.ts` — Added `purgeAllClaims()`, `purgeAllRuns()` functions
- `services/claims-api/src/storage/index.ts` — Exported purge functions
- `services/claims-api/src/routes/admin/claims.ts` — Added `DELETE /admin/claims/purge-all`
- `services/claims-api/src/routes/admin/runs.ts` — Added `DELETE /admin/runs/purge-all`
- `ui/src/admin/api.ts` — Added `purgeAllClaims()`, `purgeAllRuns()`

### Verification
```
Purge claims: {"claims":1,"events":1,"message":"Purged 1 claims and 1 events"}
Purge runs: {"runs":0,"run_events":0,"message":"Purged 0 runs and 0 run events"}
After purge: Claims: 0, Runs: 0
```

---

## Phase 2: Stage Stepper + Decision Fix (Issues #2, #9, #19)

### Checklist
- [x] 2.1 Stepper shows only PAID or CLOSED_NO_PAY (not both) based on actual claim outcome
- [x] 2.2 Decision data extracted directly from event `data` (not `data.data`)
- [x] 2.3 Stage labels use friendly names via `stageName()` mapping
- [x] 2.4 Event labels no longer show misleading outcome names for stage_started events

### Fix Details
- `PIPELINE_STAGES` array replaced with `getVisibleStages(claimStage)` function that dynamically shows the correct terminal stage
- Decision data extraction changed from `srData?.data` to `srEvent?.data` — the event's `data` field IS the decision object directly
- All stage labels go through `stageName()` which maps internal identifiers to human-readable names (e.g., `FINAL_DECISION_DONE` → "Decision Made")

### Files Modified
- `ui/src/admin/pages/Claims.tsx` — Rewrote stepper logic, fixed decision extraction
- `ui/src/components/ClaimView.tsx` — Added `STAGE_LABELS` map, pipeline button hides after completion

---

## Phase 3: Friendly Display Names (Issue #11)

### Checklist
- [x] 3.1 Created `displayNames.ts` with maps for agents, stages, statuses, event types
- [x] 3.2 Applied to RunViewer table (agent names, stage names, status names)
- [x] 3.3 Applied to Overview tables
- [x] 3.4 Applied to Claims list and detail
- [x] 3.5 Applied to Audit Explorer
- [x] 3.6 Applied to Agents page (stage names)

### Files Created
- `ui/src/admin/displayNames.ts` — Agent name map, stage name map, status name map, event type name map, plus helper functions

---

## Phase 4: Content Overflow & Copy (Issue #8)

### Checklist
- [x] 4.1 Created `TruncatedValue` component with truncate + copy-to-clipboard
- [x] 4.2 Applied to claim IDs, VINs, hashes across all pages
- [x] 4.3 Applied to run IDs in audit and run viewer
- [x] 4.4 Applied to audit explorer hash column

### Files Created
- `ui/src/admin/components/TruncatedValue.tsx` — Renders truncated text with "⧉" copy button and "✓" confirmation

### CSS Added
- `.truncated-value`, `.truncated-text`, `.copy-btn` styles in `admin.css`

---

## Phase 5: Table Layout & Sorting (Issues #7, #10, #16, #17)

### Checklist
- [x] 5.1 Created reusable `useSort` hook and `SortTh` component
- [x] 5.2 Claims Explorer — fixed column widths, claim ID truncation
- [x] 5.3 Run Viewer — sorting on all columns
- [x] 5.4 Audit Explorer — fixed status column wrapping, sorting
- [x] 5.5 All tables use `table-fixed` layout with defined column widths

### Files Created
- `ui/src/admin/components/SortableHeader.tsx` — `useSort<T>` hook for client-side sort, `SortTh` clickable header component with arrows

### CSS Added
- `.table-fixed` with `table-layout: fixed` and column width classes (`.col-id`, `.col-stage`, `.col-status`, etc.)
- `.sortable-th`, `.sort-active` for sortable header styling
- `.cell-ellipsis`, `.cell-nowrap` for text overflow control

---

## Phase 6: UI Polish (Issues #12, #13, #14, #15)

### Checklist
- [x] 6.1 Run detail agent name — reduced from `h2` default to `1.1rem`, class `run-detail-title`
- [x] 6.2 Added `run-section` class for vertical spacing between sections
- [x] 6.3 Pipeline button hidden after completion (`canRunPipeline` only true for `FNOL_SUBMITTED`)
- [x] 6.4 Pipeline result shows stages as arrow chain: `Front Desk Review → Coverage Verified → ...`
- [x] 6.5 Search bar placeholder fits with `font-size: 0.75rem` and `min-width: 140px` / `max-width: 200px`

### Files Modified
- `ui/src/components/ClaimView.tsx` — Pipeline button visibility logic, stages completed as arrow chain
- `ui/src/admin/pages/RunViewer.tsx` — Agent name sizing, section spacing
- `ui/src/admin/admin.css` — `.run-detail-title`, `.run-section`, filter input sizing

---

## Phase 7: Audit Explorer Overhaul (Issues #5, #18)

### Checklist
- [x] 7.1 Empty Run ID shows "N/A" instead of "—"
- [x] 7.2 Empty Actor shows "System" instead of "—"
- [x] 7.3 Table uses fixed column widths for consistent layout
- [x] 7.4 All columns sortable
- [x] 7.5 Claims panel with truncated IDs and stage badges
- [x] 7.6 Search input constrained width

### Explanation of Empty Fields
- `CLAIM_CREATED` events don't have `run_id` or `actor_id` because they are emitted during claim creation, not during a pipeline run. Showing "N/A" and "System" respectively is accurate.

### Files Modified
- `ui/src/admin/pages/Audit.tsx` — Full rewrite with sorting, truncated values, display names, fixed columns

---

## Phase 8: Routing Fix (Issue #6)

### Checklist
- [x] 8.1 Implemented hash-based routing (`#/claims`, `#/runs?selected=...`)
- [x] 8.2 Admin page state synced with URL hash
- [x] 8.3 Browser back/forward buttons work within admin pages

### Implementation
- `AdminApp.tsx` now uses `window.location.hash` for navigation
- `parseHash()` extracts page name and query params from hash
- `navigateTo()` sets the hash, which triggers `hashchange` event
- `useEffect` listens to `hashchange` and updates state accordingly
- Page components receive `key` prop based on `pageParams` to force re-mount when params change

### Files Modified
- `ui/src/admin/AdminApp.tsx` — Hash-based routing with `hashchange` listener, `useCallback` for `navigateTo`

---

## Phase 9: Assessor Web Search Evidence (Issue #3)

### Checklist
- [x] 9.1 Dedicated "Web Search Evidence" section in RunDetail for assessor runs
- [x] 9.2 Shows search queries, clickable citation links with excerpts
- [x] 9.3 Shows pricing source badge (web_search vs simulated)
- [x] 9.4 "Damage Analysis" section shows detected damage table from assessor output

### Implementation
- RunDetail detects assessor runs via `run.agent_id?.includes("assessor")`
- Reads `output_json.web_search` for queries, citations, pricing source
- Reads `output_json.detected_damage` for damage analysis table
- Uses same web search evidence CSS classes as the public DamagePhotoUploader

### Files Modified
- `ui/src/admin/pages/RunViewer.tsx` — Added assessor-specific sections after the events timeline

---

## Phase 10: Test Cases & Runner (Issue #4)

### Checklist
- [x] 10.1 Created test case JSON schema with 30 cases
- [x] 10.2 10 cases with images, 12+ designed to fail (fraud, exclusions, lapsed policies)
- [x] 10.3 Test runner script (`run-tests.sh`) — creates claim, uploads images, runs pipeline, compares outcomes
- [x] 10.4 Versioned output logging (`test-cases/results/<version>/`)
- [x] 10.5 Comparison UI page in admin (`/admin#/tests`)
- [x] 10.6 Backend endpoint for test runs listing and detail

### Test Case Distribution
| Category | Count | Examples |
|----------|-------|---------|
| Clean approve (with images) | 10 | TC01-TC10: minor scratch to total loss |
| Clean approve (no images) | 8 | TC11-TC12, TC19-TC24, TC27, TC29 |
| Expected deny (fraud) | 8 | TC15-TC18, TC25-TC26, TC28 |
| Expected deny (exclusion) | 4 | TC13, TC14, TC30 |

### Files Created
- `test-cases/cases.json` — 30 test cases with claim payloads, expected outcomes
- `test-cases/run-tests.sh` — Bash test runner
- `test-cases/images/` — Copy of test images for image-based cases
- `ui/src/admin/pages/TestComparison.tsx` — Comparison UI with consistency metrics
- `services/claims-api/src/routes/admin/testRuns.ts` — Backend endpoint to list/read test results

### Files Modified
- `services/claims-api/src/index.ts` — Registered test runs routes
- `ui/src/admin/AdminApp.tsx` — Added Tests nav item and page
- `ui/src/admin/api.ts` — Added `getTestRuns()`, `getTestRunDetail()`
- `ui/src/admin/admin.css` — Added `.comparison-diff-row` styling

---

## Build Verification

```
Backend TSC: OK (0 errors)
Frontend Vite build: OK (51 modules, 25.24 KB CSS + 265.77 KB JS)
Local API smoke test: All endpoints verified
Linter: 0 errors
```

---

## Summary of All Changes (v2)

### Backend (`services/claims-api/src/`)
| File | Changes |
|------|---------|
| `storage/dynamo.ts` | Added `BatchWriteCommand`, `DeleteCommand`; `batchDeleteAll()`, `purgeAllClaims()`, `purgeAllRuns()` |
| `storage/memory.ts` | Added `purgeAllClaims()`, `purgeAllRuns()` |
| `storage/index.ts` | Exported purge functions |
| `routes/admin/claims.ts` | Added `DELETE /admin/claims/purge-all` |
| `routes/admin/runs.ts` | Added `DELETE /admin/runs/purge-all` |
| `routes/admin/testRuns.ts` | **NEW** — `GET /admin/test-runs`, `GET /admin/test-runs/:version` |
| `index.ts` | Registered test runs routes |

### Frontend (`ui/src/`)
| File | Changes |
|------|---------|
| `admin/displayNames.ts` | **NEW** — Agent, stage, status, event type name mappings |
| `admin/components/TruncatedValue.tsx` | **NEW** — Truncate + copy-to-clipboard component |
| `admin/components/SortableHeader.tsx` | **NEW** — `useSort` hook + `SortTh` component |
| `admin/pages/TestComparison.tsx` | **NEW** — Test run comparison page |
| `admin/AdminApp.tsx` | Hash-based routing, Tests nav item |
| `admin/api.ts` | Added purge, test-runs API calls |
| `admin/pages/Claims.tsx` | Fixed stepper (single outcome), decision data, display names, sorting, truncation |
| `admin/pages/RunViewer.tsx` | Display names, sorting, truncation, assessor web search section, spacing |
| `admin/pages/Audit.tsx` | Display names, sorting, truncation, N/A for empty fields |
| `admin/pages/Overview.tsx` | Display names |
| `admin/pages/Agents.tsx` | Display names for stages |
| `admin/admin.css` | Fixed column widths, sortable headers, truncated values, comparison styles |
| `components/ClaimView.tsx` | Pipeline button hides after run, stages as arrow chain, stage labels |
| `App.css` | Pipeline completed message style |

### Test Infrastructure
| File | Purpose |
|------|---------|
| `test-cases/cases.json` | 30 test cases (10 with images, 12 failure cases) |
| `test-cases/run-tests.sh` | Automated test runner with versioned output |
| `test-cases/images/` | 7 test images for image-based cases |
