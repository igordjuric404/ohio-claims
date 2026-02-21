# Implementation Plan — Features & Issues v1

## Phase 1: Data & Bug Fixes (Issues #2, #4, #7)
**Goal**: Fix stale runs, fix runs-mismatch for old claims, seed the 6 pipeline agents.

### 1.1 Fix stale "RUNNING" runs (#2)
- Query DynamoDB Runs table for status=RUNNING
- Mark any that have no corresponding active process as FAILED (with `error: "stale — cleaned up"`)
- Add a backend endpoint `POST /admin/runs/cleanup-stale` that marks runs older than 5 minutes with status RUNNING as FAILED
- Root cause: the early failed pipeline attempts created Runs in RUNNING state but crashed before updating them

### 1.2 Fix runs-mismatch for pre-Phase0 claims (#4)
- Claim CLM-O-CX2i_Zmr8A was created before the Runs-tracking code existed
- The admin `/admin/claims/:id` endpoint calls `getRunsForClaim` which scans by `claim_id` — for old claims there are simply no Runs
- Fix: The UI should show "No runs recorded (claim predates run tracking)" instead of "Runs (0)" when runs array is empty and claim is past FNOL_SUBMITTED

### 1.3 Seed agents from pipeline config (#7)
- Create a backend endpoint `POST /admin/agents/seed` that populates the Agents table with the 6 pipeline agents
- Each agent gets: agent_id, display_name, enabled=true, model_primary, tool_allowlist, pipeline_stage
- Add a `status` field (idle/working/disabled) and `last_run_at` for live visualization
- Update the Agents UI to show visual status indicators

## Phase 2: Backend — Store Full Agent I/O (Issues #11, #12)
**Goal**: The orchestrator must persist the full prompt sent to each agent, the raw response text, and the parsed output into RunEvents so the UI can display them.

### 2.1 Enrich RunEvents with full I/O
- In `runStage()`: emit a `agent.input` RunEvent containing the full system prompt + user message
- In `runStage()`: emit `agent.raw_output` RunEvent with the raw text returned by the agent
- In `stage.completed`: include the full parsed JSON output (not just key names)
- For assessment runs: include image metadata (keys, count) in the input event

### 2.2 Enrich Run record with I/O pointers
- Store `input_prompt` (or first 2000 chars + truncation flag) on the Run record itself
- Store `output_json` (the parsed result) on the Run record
- This allows the detail view to show everything without joining multiple tables

## Phase 3: Admin Overview + Navigation (Issue #1)
**Goal**: Make the overview page a real dashboard with clickable drill-down.

### 3.1 Make stat cards clickable (navigate to claims/runs/agents pages)
### 3.2 Make table rows in "Claims by Stage" clickable (filter claims page by that stage)
### 3.3 Make "Runs by Agent" rows clickable (filter runs page by that agent)
### 3.4 Add recent claims list (last 5) and recent runs (last 5) with click-through
### 3.5 Pass navigation callbacks from AdminApp to Overview

## Phase 4: Claim Details Redesign (Issue #3)
**Goal**: Human-readable claim detail page in admin with proper layout.

### 4.1 Structured sections: header with status badge, detail card, decision summary
### 4.2 Show decision status/reasoning from the senior reviewer output
### 4.3 Show pipeline stage progression as a visual stepper
### 4.4 Fix horizontal overflow — use word-wrap and constrained max-widths
### 4.5 Show "No runs recorded" message for pre-Phase0 claims

## Phase 5: Run Details Redesign (Issues #6, #11, #12)
**Goal**: Human-readable run detail with full agent I/O.

### 5.1 Structured layout: header, input section, output section, timing
### 5.2 Display full input prompt in a readable, collapsible section
### 5.3 Display parsed output in structured key-value cards (not raw JSON)
### 5.4 Display raw agent text in a collapsible section
### 5.5 Show images analyzed (thumbnails or keys) for assessor vision runs
### 5.6 Show cost breakdown from usage data

## Phase 6: Audit Explorer Defaults (Issue #8)
**Goal**: Show recent claims by default; auto-load audit on claim selection.

### 6.1 On page load, fetch recent claims and display as a list
### 6.2 Clicking a claim auto-loads its audit events
### 6.3 Keep the search bar for manual lookup

## Phase 7: Image Attachments in Both Forms (Issue #9)
**Goal**: Both FNOL forms (manual and auto-intake) accept image uploads.

### 7.1 Add image upload section to the manual ClaimForm
### 7.2 After claim creation, upload images via the existing presign flow
### 7.3 Ensure auto-intake form also accepts images (already has file upload)

## Phase 8: Assessor Web Search + Model Switch (Issue #5)
**Goal**: If Gemini Flash doesn't support web search, switch to a model that does. Show search queries/results/sources.

### 8.1 Research which OpenRouter models support web search (Perplexity, etc.)
### 8.2 Update the assessor to use web-search-capable model for pricing
### 8.3 Capture and persist search queries, results, and sources in RunEvents
### 8.4 Build a dedicated "Search Evidence" section in the assessment report UI

## Phase 9: Real Car Crash Image Testing (Issue #10)
**Goal**: Download real CC-licensed car crash images and test the assessor.

### 9.1 Find and download 5-8 appropriately licensed car damage photos
### 9.2 Create a test script that uploads them and runs the assessor
### 9.3 Validate the assessment output quality

## Phase 10: Clean Slate + Rigorous Testing (Issue #13)
**Goal**: Wipe all data, do a fresh end-to-end test with real info, ensure everything displays correctly.

### 10.1 Create a cleanup endpoint/script to wipe all DynamoDB tables
### 10.2 Run full pipeline with realistic data
### 10.3 Verify every page shows correct, formatted data
### 10.4 Write smoke tests (API-level) for the critical flows

## Phase 11: UI Redesign with New Palette (Issue #14)
**Goal**: Complete visual overhaul using the provided color palette.

### 11.1 Define CSS custom properties with the new palette
### 11.2 Apply to global styles (index.css)
### 11.3 Apply to admin styles (admin.css)
### 11.4 Apply to all component-specific CSS (App.css, intake.css)
### 11.5 Use warm accents (#CC785C, #D4A27F, #EBDBBC) for interactive elements
### 11.6 Final visual review and polish
