# Ohio Claims — QA Execution Log

## Requirements Source
`new-features-and-issues-v3.md`

## Test Strategy

### App Setup (Local)
- **Backend**: `USE_MEMORY_STORAGE=true PORT=8099 HOST=127.0.0.1 npx tsx src/index.ts`
- **Frontend**: `API_TARGET=http://127.0.0.1:8099 npx vite --port 5173`
- **Auth**: Admin password `admin-dev-password`, Reviewer password `reviewer-dev-password`
- **Data**: In-memory storage; seed agents via API; seed reviewed claims via `POST /internal/test/seed-reviewed-claim`

### Test Stack
- **E2E**: Playwright `@playwright/test` (Chromium)
- **Unit/Integration**: Vitest (existing)
- **Artifacts**: `ui/test-results/` (screenshots on every test, traces/video on failure)

### Mocking
- Backend runs with in-memory storage — no DynamoDB needed
- Test seed endpoint creates deterministic claims with full pipeline data (4 agent runs with outputs + reasoning)
- Pipeline (LLM) not invoked during tests — claims seeded directly at PENDING_REVIEW stage

---

## Coverage Matrix

| # | Requirement | Test Type | Test File(s) | Evidence | Status |
|---|-------------|-----------|--------------|----------|--------|
| R1 | Seed demo data button on client form | E2E | `ui/e2e/claim-form.spec.ts` | Button visible, populates all fields (policy, claimant, vehicle, loss) | ✅ PASS |
| R2 | Auto-trigger pipeline + client confirmation | E2E | `ui/e2e/claim-form.spec.ts` | Submit → confirmation page with 6 progress steps, no "Run Pipeline" button | ✅ PASS |
| R3 | Runs grouped by claim | E2E | `ui/e2e/admin-claims.spec.ts`, `ui/e2e/admin-nav.spec.ts` | Claims list shows claim, clicking shows runs for that claim | ✅ PASS |
| R4 | Senior reviewer agent deleted | E2E | `ui/e2e/senior-reviewer-removed.spec.ts` | Agent sections don't include "Senior Reviewer", pipeline order clean | ✅ PASS |
| R5 | Senior Reviewer role (human-in-the-loop) | E2E | `ui/e2e/reviewer.spec.ts` | Dashboard loads, claims table visible, limited sidebar (1 nav item) | ✅ PASS |
| R6 | Reviewer claim detail (agent sections, reasoning, structured) | E2E | `ui/e2e/reviewer.spec.ts` | 4 agent sections, structured output grids, reasoning panels, decision panel | ✅ PASS |
| R7 | Human-friendly labels everywhere | E2E | `ui/e2e/labels.spec.ts` | No raw variable names in reviewer or admin pages, formatted currency values | ✅ PASS |
| AUTH | Admin login flow | E2E | `ui/e2e/auth.spec.ts` | Login, logout, wrong password error | ✅ PASS |
| AUTH | Reviewer login flow | E2E | `ui/e2e/auth.spec.ts` | Login, logout, wrong password error | ✅ PASS |
| NAV | Admin sidebar navigation | E2E | `ui/e2e/admin-nav.spec.ts` | 6 nav items, all pages load | ✅ PASS |
| NAV | Reviewer sidebar navigation | E2E | `ui/e2e/reviewer.spec.ts` | 1 nav item (Claims), claims-focused | ✅ PASS |
| UNIT | Shared validation schemas | Unit | `packages/shared/tests/validate.test.ts` | 12 tests | ✅ PASS |
| UNIT | Audit event hashing | Unit | `services/claims-api/tests/audit.test.ts` | 5 tests | ✅ PASS |
| UNIT | Compliance deadlines | Unit | `services/claims-api/tests/compliance.test.ts` | 8 tests | ✅ PASS |
| UNIT | Crypto encrypt/decrypt | Unit | `services/claims-api/tests/crypto.test.ts` | 5 tests | ✅ PASS |

---

## Phases

### Phase 0: Test Strategy & Infrastructure — ✅ DONE
- Created Execution Log
- Installed `@playwright/test`, Chromium browser
- Created Playwright config (`ui/playwright.config.ts`)
- Created auth fixtures (`ui/e2e/fixtures.ts`)
- Created test helpers with API seed functions (`ui/e2e/helpers.ts`)
- Added test seed route (`services/claims-api/src/routes/testSeed.ts`) — only active with `USE_MEMORY_STORAGE=true`
- Verified app starts locally (backend + frontend + proxy)

### Phase 1: Validate Login (P0) — ✅ DONE
- 8 E2E tests: admin login/logout/error, reviewer login/logout/error
- All pass. Screenshots captured.

### Phase 2: Validate Public Claim Submission — ✅ DONE
- 4 E2E tests: FNOL view default, seed demo data, form submission → confirmation, no pipeline button
- Seed demo data populates all fields correctly (POL-OH-2024-83921, Sarah Mitchell, Honda Accord)
- Submit triggers pipeline automatically, shows ClientConfirmation with 6 pipeline steps
- No "Run Pipeline" button visible after submission

### Phase 3: Validate Admin Dashboard & Claims Grouping — ✅ DONE
- 7 E2E tests: sidebar nav (6 items), dashboard loads, claims/agents/audit pages
- Claims list shows seeded claim, clicking it shows runs for that specific claim
- Admin sidebar has: Dashboard, Claims, Runs, Agents, Audit, Tests

### Phase 4: Validate Reviewer Dashboard & Detail — ✅ DONE
- 9 E2E tests: dashboard, claim table, sidebar, detail page, agent sections, outputs, reasoning, decision panel
- Reviewer sidebar limited to 1 item (Claims) — no deep internal dashboards
- Claim detail shows: summary card, 4 agent sections (Front Desk, Claims Officer, Assessor, Fraud Analyst)
- Each section has: agent name, structured output grid, reasoning (for 3 agents), compliance details
- Decision panel shows Approve/Deny buttons with rationale textarea

### Phase 5: Validate Human-friendly Labels — ✅ DONE
- 4 E2E tests: reviewer detail labels, formatted values, admin stage names, reviewer stage names
- No raw variable names (`repair_estimate_low`, `total_loss_recommended`, etc.) found in rendered UI
- Currency values formatted as `$2,800`, `$3,500`
- Stage names displayed as "Pending Review" not "PENDING_REVIEW"

### Phase 6: Validate Senior Reviewer Agent Removal — ✅ DONE
- 2 E2E tests: agent sections don't include seniorreviewer, pipeline order clean
- AGENT_ORDER in ReviewerClaimDetail.tsx: `["frontdesk", "claimsofficer", "assessor", "fraudanalyst"]` (no seniorreviewer)
- Pipeline transitions from FRAUD_DONE → PENDING_REVIEW (human decision, not agent)

---

## Final Results

### E2E Tests (Playwright)
```
34 passed (42.9s)
```

### Unit Tests (Vitest)
```
packages/shared:  12 passed
services/claims-api: 18 passed
Total: 30 passed
```

### Total: 64 tests, 64 passed, 0 failed

---

## Files Created/Modified

### Created
- `ui/playwright.config.ts` — Playwright configuration
- `ui/e2e/fixtures.ts` — Auth helpers and test base
- `ui/e2e/helpers.ts` — API helpers (seed, purge, create claim)
- `ui/e2e/auth.spec.ts` — 8 auth E2E tests
- `ui/e2e/claim-form.spec.ts` — 4 claim form E2E tests
- `ui/e2e/admin-nav.spec.ts` — 5 admin navigation E2E tests
- `ui/e2e/admin-claims.spec.ts` — 2 admin claims E2E tests
- `ui/e2e/reviewer.spec.ts` — 9 reviewer E2E tests
- `ui/e2e/labels.spec.ts` — 4 label E2E tests
- `ui/e2e/senior-reviewer-removed.spec.ts` — 2 senior reviewer removal E2E tests
- `services/claims-api/src/routes/testSeed.ts` — Test seed endpoint (memory-only)

### Modified
- `services/claims-api/src/index.ts` — Registered testSeed route
- `ui/package.json` — Added `@playwright/test` dependency

---

## Hotfix Round 2 (User Feedback)

### Fix 1: Client Confirmation Simplified
- **Problem**: After form submission, the client saw a pipeline progress tracker with internal stages
- **Fix**: Replaced with a simple "Form Submitted for Review" message with claim reference
- **File**: `ui/src/components/ClientConfirmation.tsx` — rewritten to static confirmation
- **Evidence**: E2E test `claim-form.spec.ts` "R2: form submission shows simple confirmation message" — PASS

### Fix 2: Assessor Web Search for Real Pricing
- **Problem**: Assessor agent used `google/gemini-2.0-flash-001` (no web access), made up estimates
- **Fix**: 
  - Switched assessor to `google/gemini-2.0-flash-001:online` model (web search enabled)
  - Rewrote `openclaw/agents/assessor/SYSTEM_PROMPT.md` to explicitly require web search for part prices and labor rates
  - Added `damaged_components`, `assessment_notes`, `pricing_sources` to output schema
  - Updated `packages/shared/src/types.ts` (AssessorOutput type)
  - Updated `ui/src/lib/fieldLabels.ts` (human-friendly labels for new fields)
  - Updated `services/claims-api/src/openclaw/orchestrator.ts` to use online model for assessor
- **Files changed**: 
  - `openclaw/agents/assessor/SYSTEM_PROMPT.md`
  - `openclaw/agents/assessor/OUTPUT_SCHEMA.json`
  - `services/claims-api/src/openclaw/orchestrator.ts`
  - `packages/shared/src/types.ts`
  - `ui/src/lib/fieldLabels.ts`
- **Evidence**: All 34 E2E + 30 unit tests pass (64 total, 0 failures)

### Phase: Assessor Web Search + Pricing Sources UI
- **Goal**: Ensure assessor uses real web search for pricing; display clickable source links
- **Status**: Done

#### Changes
- **Backend**: Two-phase assessor approach in `orchestrator.ts`:
  1. Phase 1: `webSearchForPricing()` call using OpenRouter web plugin with `max_results: 10`
  2. Phase 2: Standard assessor call receives pricing research + claim data
  3. Citations from `message.annotations[].url_citation` merged into `pricing_sources`
- **Client**: Added `UrlCitation` type, `citations` field to `AgentResponse`, `WebSearchPlugin` type, plugins support in `callOpenRouterDirect`
- **System Prompt**: Strengthened to require actual URLs, not placeholders
- **UI**: New `PricingSourcesPanel` component in `ReviewerClaimDetail.tsx`:
  - Extracts URL + label from each pricing source string
  - Renders clickable links with site favicons (Google S2 API), labels, external-link icons
  - Responsive chip/tag layout with hover states
  - Also added to admin `RunViewer.tsx`
- **CSS**: 75+ lines in `App.css` for `.pricing-sources-*` classes
- **E2E Tests**: 2 new tests verifying panel visibility, link attributes, favicons, labels

#### Evidence
- Created claim `CLM-MgHM2K1WywSM` on production — assessor returned real URLs from:
  - `repairpal.com` — repair cost estimates
  - `yourmechanic.com` — control arm/strut replacement costs
  - `rockauto.com` — parts catalog
  - `columbuscollision.com` — local Columbus body shop
  - `autohausaz.com` — parts supplier
- All 36 E2E tests pass (including 2 new pricing sources tests)
- Commits: `284063c`, `cc8866a`

---

## Artifacts
- Screenshots: `ui/test-results/` (captured on every test)
- Traces: `ui/test-results/` (captured on failure)
- HTML report: `ui/test-results/html/` (run `npx playwright show-report test-results/html`)

---

## Phase: Image Analyzer + Split Assessor Pipeline
**Status**: Done
**Date**: 2026-02-21

### What was implemented

1. **Image Analyzer Agent (backend)**
   - New `analyzeImagesWithVision()` function in `client.ts` sends photos to Gemini 2.0 Flash Vision
   - New `getObjectAsBase64()` in `s3.ts` fetches photo binaries from S3
   - System prompt at `openclaw/agents/image_analyzer/SYSTEM_PROMPT.md`
   - Returns per-image descriptions, damaged components list, severity, labor estimates

2. **Split Assessor Pipeline (orchestrator)**
   - Pipeline now runs image analysis BEFORE the assessor/researcher
   - `runImageAnalysis()` fetches photos from S3, sends to Gemini Vision
   - Assessor receives image analysis results + web research results in its prompt
   - Web search uses identified damaged components for targeted pricing queries
   - Graceful fallback when no photos are available

3. **Reviewer UI — Image Descriptions**
   - New `DamagePhotosWithDescriptions` component in `ReviewerClaimDetail.tsx`
   - Photos displayed as cards with AI description, damaged part tags, and severity badge
   - Image Analyzer appears as a dedicated agent section in the reviewer detail
   - CSS: `.damage-photo-card`, `.damage-part-tag`, `.severity-*` badges
   - Responsive layout (stacks vertically on mobile)

4. **Test Seed Data & E2E Tests**
   - Updated `testSeed.ts` with `image_analyzer` run (3 image descriptions)
   - Updated agent count test (4 → 5 agent sections)
   - New test: image analyzer section shows damaged components
   - All 37 E2E tests passing

### Files Modified
- `services/claims-api/src/openclaw/client.ts` — `analyzeImagesWithVision()`, `ImagePart` type
- `services/claims-api/src/openclaw/orchestrator.ts` — `runImageAnalysis()`, split pipeline
- `services/claims-api/src/storage/s3.ts` — `getObjectAsBase64()`
- `services/claims-api/src/routes/testSeed.ts` — image_analyzer seed data
- `openclaw/agents/image_analyzer/SYSTEM_PROMPT.md` — new agent prompt
- `ui/src/reviewer/pages/ReviewerClaimDetail.tsx` — `DamagePhotosWithDescriptions`
- `ui/src/App.css` — damage photo card styles
- `ui/src/admin/displayNames.ts` — added "Image Analyzer" display name
- `ui/src/lib/fieldLabels.ts` — image analyzer field labels
- `ui/e2e/reviewer.spec.ts` — updated & new E2E tests

### Evidence
- Production claim `CLM-qrIHiEc8KeEL`: image_analyzer run SUCCEEDED, assessor has 11 pricing source URLs
- All 37 E2E tests pass locally
- Deployed to EC2 + Cloudflare Pages
- Commit: `352c06f` pushed to main

---

## How to Run
```bash
# Start backend (in-memory)
cd ohio-claims/services/claims-api
USE_MEMORY_STORAGE=true PORT=8099 HOST=127.0.0.1 npx tsx src/index.ts

# Start frontend (in another terminal)
cd ohio-claims/ui
API_TARGET=http://127.0.0.1:8099 npx vite --port 5173

# Run E2E tests
cd ohio-claims/ui
npx playwright test --reporter=list

# Run unit tests
cd ohio-claims
pnpm test
```
