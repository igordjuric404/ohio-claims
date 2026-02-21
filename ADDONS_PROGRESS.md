# Ohio Claims Pipeline — Add-ons Progress Tracker

## Phase 0: Foundation (Runs + Actor + Trace + Attachment Typing)

### AWS Changes
- [ ] Create DynamoDB table: `Runs` (PK=run_id)
- [ ] Create DynamoDB table: `Agents` (PK=agent_id)
- [ ] Create DynamoDB table: `RunEvents` (PK=run_id, SK=seq)
- [ ] Add GSIs on Runs table

### Backend Code
- [ ] Add shared types: Run, RunEvent, AgentConfig, AttachmentMeta
- [ ] Install deps: ulid
- [ ] Add storage functions for Runs and RunEvents (dynamo + memory)
- [ ] Modify orchestrator to create/update Runs per stage (run_id, actor_id, trace_id)
- [ ] Add attachment metadata endpoint: `PUT /edge/claims/:id/attachments/:key/metadata`
- [ ] Add runs read endpoints: `GET /edge/claims/:id/runs`, `GET /edge/runs/:run_id`
- [ ] Update events to include run_id, actor_id, trace_id
- [ ] Tests pass

## Phase 1: Admin Console Backend (RBAC + Metrics + CRUD)
- [ ] Admin auth (SSM password + session cookie)
- [ ] Admin overview endpoint
- [ ] Claims explorer endpoints
- [ ] Runs query endpoints
- [ ] Audit search endpoint
- [ ] Usage rollups endpoint
- [ ] Agents CRUD endpoints

## Phase 2: Admin Console UI + Realtime Run Viewer
- [ ] Admin login page
- [ ] Overview dashboard
- [ ] Claims explorer page
- [ ] Run/Trace viewer (replay + live SSE)
- [ ] Agents editor page
- [ ] Audit explorer page
- [ ] Deploy UI

## Phase 3: Autonomous Intake v1
- [ ] Create IntakeJobs DynamoDB table
- [ ] Intake API endpoints (create job, presign, get, confirm)
- [ ] Intake worker (classification + extraction)
- [ ] LLM fallback extraction via OpenRouter
- [ ] Intake UI (file upload, field editor, confirm)

## Phase 5: Image-Based Damage Assessment
- [ ] Multi-photo damage upload UI
- [ ] Image allowlist enforcement on presign
- [ ] Assessor stage with image inputs
- [ ] Pricing/labor/valuation tools
- [ ] Assessor output schema + report
- [ ] Total loss logic
