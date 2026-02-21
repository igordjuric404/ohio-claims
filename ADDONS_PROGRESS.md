# Ohio Claims Pipeline — Add-ons Progress Tracker

## Bug Fix: 400 Error on Pipeline Run
- [x] Fixed Content-Type header sent without body in fetchApi
- [x] Deployed and verified via Cloudflare Pages

## Phase 0: Foundation (Runs + Actor + Trace + Attachment Typing) — DONE
- [x] Created DynamoDB tables: Runs (PK=run_id), Agents (PK=agent_id), RunEvents (PK=run_id, SK=seq)
- [x] Added shared types: Run, RunEvent, AgentConfig, AttachmentMeta, IntakeJob
- [x] Installed ulid dependency for run_id generation
- [x] Added storage functions for Runs and RunEvents (DynamoDB + in-memory)
- [x] Modified orchestrator: creates Run per stage with ULID, actor_id, trace_id
- [x] Tracks model, usage (tokens), duration_ms per run
- [x] Emits RunEvents for stage lifecycle (started, response, completed/failed)
- [x] Added runs read endpoints: GET /edge/claims/:id/runs, GET /edge/runs/:run_id
- [x] Fixed DynamoDB reserved keyword issue (`usage` → expression attribute names)
- [x] All events include run_id, actor_id, trace_id
- [x] Tests: 30/30 pass

## Phase 1: Admin Console Backend (RBAC + Metrics + CRUD) — DONE
- [x] Admin session-cookie auth (HMAC-signed, 12h expiry, HttpOnly)
- [x] Admin password stored in SSM Parameter Store SecureString
- [x] GET /admin/overview — dashboard metrics (claims, runs, tokens, avg latency)
- [x] GET /admin/claims — paginated claims explorer with stage/search filters
- [x] GET /admin/claims/:id — claim detail with events and runs
- [x] GET /admin/runs — paginated runs with agent/stage/status filters
- [x] GET /admin/runs/:run_id — run detail with events
- [x] GET /admin/runs/:run_id/stream — SSE live tail for run events
- [x] GET /admin/audit — audit event search by claim/actor/type
- [x] GET /admin/usage — token/run usage rollups by agent/stage/day
- [x] CRUD /admin/agents — agent config management
- [x] Pages Function proxy updated for /admin/* passthrough
- [x] All endpoints protected with requireAdmin middleware
- [x] 401 returned without cookie ✓

## Phase 2: Admin Console UI + Realtime Run Viewer — DONE
- [x] Admin SPA with sidebar navigation (Overview, Claims, Runs, Agents, Audit)
- [x] Login page with session-cookie auth
- [x] Overview dashboard: claim counts, run metrics, token usage, avg latency
- [x] Claims explorer: paginated list with stage/search filters, drill into detail
- [x] Run viewer: table of all runs, detailed view with event timeline
- [x] Live SSE tail for in-progress runs
- [x] Agents editor: list, create, enable/disable agents
- [x] Audit explorer: search events by claim ID, filter by type
- [x] Admin-specific dark-mode CSS with status badges, timeline, stat cards
- [x] SPA routing: /admin/* serves admin console, / serves public FNOL app
- [x] Deployed to Cloudflare Pages with _redirects for SPA fallback

## Phase 3: Autonomous Intake v1 (Upload → Extract → Review → Submit) — DONE
- [x] Created IntakeJobs DynamoDB table
- [x] IntakeJobs storage layer (DynamoDB + in-memory)
- [x] POST /edge/intake/jobs — create intake job
- [x] POST /edge/intake/jobs/:id/files/presign — presign file upload to S3
- [x] POST /edge/intake/jobs/:id/extract — trigger extraction
- [x] GET /edge/intake/jobs/:id — poll for status
- [x] POST /edge/intake/jobs/:id/confirm — create claim from extracted fields
- [x] LLM extraction via OpenRouter Gemini Flash
- [x] PDF text extraction via pdf-parse
- [x] Extraction returns: fields, confidence scores, provenance
- [x] Intake UI: file upload, extraction progress, field editor with confidence badges
- [x] Public app has tabs: Manual FNOL and Automatic Intake
- [x] E2E verified: upload → extract → confirm → claim created ✓

## Phase 5: Image-Based Damage Assessment — DONE
- [x] Damage photo upload: POST /edge/claims/:id/damage-photos/presign
- [x] Image allowlist enforcement (JPEG, PNG, WebP only)
- [x] Non-image content types rejected ✓
- [x] Assessment endpoint: POST /edge/claims/:id/assess
- [x] Vision model (Gemini Flash) with base64-encoded images from S3
- [x] Pricing tools: searchParts, getLocalLaborRate, getACV
- [x] Structured report: detected damage, parts, labor, totals
- [x] Ohio-configurable total loss logic (repair + salvage vs ACV, salvage_pct=0.20)
- [x] Assessment tracked as Run with run_id, duration, usage
- [x] DamagePhotoUploader UI with upload + report display
- [x] Severity badges (minor/moderate/severe)
- [x] E2E verified: upload photo → assess → report with pricing ✓

## Final Verification — DONE
- [x] Healthcheck: OK
- [x] Manual FNOL + full 6-stage pipeline: PAID (6/6 stages, 6 runs)
- [x] Admin login + overview: 8 claims, 21 runs, 12789 tokens, 1240ms avg
- [x] Intake job creation: OK
- [x] Assessment presign: OK
- [x] Cloudflare Pages: Public UI 200, Admin UI 200
- [x] All 30 tests pass across packages/shared and services/claims-api
