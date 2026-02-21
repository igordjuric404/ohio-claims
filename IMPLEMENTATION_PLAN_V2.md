# Implementation Plan — Features & Issues v2

## Phase 1: Database Clean Slate (Issue #1)
**Goal**: Remove all existing runs and claims to start fresh.
- [ ] 1.1 Add `DELETE /admin/claims/purge-all` backend endpoint (deletes all claims + events)
- [ ] 1.2 Add `DELETE /admin/runs/purge-all` backend endpoint (deletes all runs + run events)
- [ ] 1.3 Add `purgeAllClaims()` and `purgeAllRuns()` API calls in frontend
- [ ] 1.4 Execute purge and verify empty state

## Phase 2: Stage Stepper + Decision Fix (Issues #2, #9, #19)
**Goal**: Fix stepper to only show actual outcome; fix empty Decision section; fix misleading stage labels.
- [ ] 2.1 Filter stepper: only show PAID or CLOSED_NO_PAY (not both) based on claim's actual final stage
- [ ] 2.2 Fix Decision data extraction — investigate why `srData?.data` is empty for completed claims
- [ ] 2.3 Fix stage labels: stage_started events should show the incoming stage name, not the outcome name
- [ ] 2.4 Fix agent cards to not show misleading outcome names for stage labels

## Phase 3: Friendly Display Names (Issue #11)
**Goal**: Replace raw internal values with human-friendly names across the entire UI.
- [ ] 3.1 Create shared `displayNames.ts` with agent name map and stage label map
- [ ] 3.2 Apply to RunViewer table columns (agent, stage, status)
- [ ] 3.3 Apply to Overview tables (runs by agent, claims by stage)
- [ ] 3.4 Apply to Claims list and detail views
- [ ] 3.5 Apply to Audit Explorer
- [ ] 3.6 Apply to Agents page

## Phase 4: Content Overflow & Copy (Issue #8)
**Goal**: Truncate overflowing content and add copy-to-clipboard buttons.
- [ ] 4.1 Create `TruncatedValue` component (truncate + "Copy" button)
- [ ] 4.2 Apply to claim detail page (encrypted data, long IDs, hashes)
- [ ] 4.3 Apply to audit explorer (hashes, run IDs)
- [ ] 4.4 Apply to run detail page (run IDs, claim IDs)

## Phase 5: Table Layout & Sorting (Issues #7, #10, #16, #17)
**Goal**: Fix column sizing, add sorting to all tables.
- [ ] 5.1 Create reusable `SortableTable` header component
- [ ] 5.2 Apply to Claims Explorer table — fix claim ID wrapping, claimant column width
- [ ] 5.3 Apply to Run Viewer table
- [ ] 5.4 Apply to Audit Explorer table — fix status column wrapping
- [ ] 5.5 Apply to Overview tables
- [ ] 5.6 Add fixed column widths via CSS for consistent sizing

## Phase 6: UI Polish (Issues #12, #13, #14, #15)
**Goal**: Fix agent name size, pipeline button state, results text, search placeholder.
- [ ] 6.1 Fix run detail agent name — reduce size, prevent overflow
- [ ] 6.2 Add vertical spacing between run detail sections
- [ ] 6.3 Fix pipeline button — disable/hide after pipeline has run (when claim is beyond FNOL_SUBMITTED)
- [ ] 6.4 Fix pipeline result "Completed: —" — show human-readable completed stages or remove if empty
- [ ] 6.5 Fix search bar placeholder text fitting

## Phase 7: Audit Explorer Overhaul (Issues #5, #18)
**Goal**: Significantly improve audit explorer UI; fix empty Run ID and Actor fields.
- [ ] 7.1 Investigate why run_id and actor_id are empty in CLAIM_CREATED events
- [ ] 7.2 Show "N/A" or "System" for events where actor/run are legitimately absent
- [ ] 7.3 Improve overall layout: better spacing, card-based event display, proper column sizing
- [ ] 7.4 Add event type filtering chips/tabs
- [ ] 7.5 Improve claims panel with better visual hierarchy

## Phase 8: Routing Fix (Issue #6)
**Goal**: Fix back button so it navigates within admin pages instead of going to public form.
- [ ] 8.1 Implement hash-based or history API routing for admin pages
- [ ] 8.2 Update AdminApp to sync page state with URL hash
- [ ] 8.3 Ensure browser back/forward buttons work within admin

## Phase 9: Assessor Web Search Evidence (Issue #3)
**Goal**: Show web search details in assessor run detail with image rendering.
- [ ] 9.1 Add dedicated "Web Search Evidence" section in RunDetail for assessor runs
- [ ] 9.2 Display search queries, result links, and extracted information
- [ ] 9.3 If images exist, render them inline and show what the assessor analyzed

## Phase 10: Test Cases & Runner (Issue #4)
**Goal**: Create 30 diverse test cases, a runner script, and a comparison page.
- [ ] 10.1 Design test case schema (JSON format with claim data, expected behavior)
- [ ] 10.2 Create 30 test cases: minor/major spectrum, cheap/expensive vehicles, 10 with images
- [ ] 10.3 Create ~12 cases designed to fail at specific agents
- [ ] 10.4 Create folder structure for test images
- [ ] 10.5 Build test runner script that executes all cases and captures output
- [ ] 10.6 Run script, verify failures match intent, refine cases
- [ ] 10.7 Add versioned output logging to the script
- [ ] 10.8 Run script twice, compare outputs
- [ ] 10.9 Build comparison UI page in admin
