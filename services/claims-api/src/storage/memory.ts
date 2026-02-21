/**
 * In-memory storage implementation for local development/testing.
 * Drop-in replacement for dynamo.ts when AWS is not configured.
 */

const claims = new Map<string, Record<string, unknown>>();
const events = new Map<string, Array<Record<string, unknown>>>();
const runs = new Map<string, Record<string, unknown>>();
const runEvents = new Map<string, Array<Record<string, unknown>>>();
const agents = new Map<string, Record<string, unknown>>();

export async function putClaim(claim: Record<string, unknown>) {
  claims.set(claim.claim_id as string, { ...claim });
}

export async function getClaim(claimId: string) {
  return claims.get(claimId) ?? null;
}

export async function updateClaimStage(claimId: string, stage: string) {
  const claim = claims.get(claimId);
  if (claim) {
    claim.stage = stage;
    claim.updated_at = new Date().toISOString();
  }
}

export async function putEvent(event: Record<string, unknown>) {
  const claimId = event.claim_id as string;
  if (!events.has(claimId)) events.set(claimId, []);
  events.get(claimId)!.push({ ...event });
}

export async function getLastEvent(claimId: string) {
  const list = events.get(claimId) ?? [];
  return list.length > 0 ? list[list.length - 1] : null;
}

export async function getEvents(claimId: string) {
  return events.get(claimId) ?? [];
}

// --- Runs ---

export async function putRun(run: Record<string, unknown>) {
  runs.set(run.run_id as string, { ...run });
}

export async function getRun(runId: string) {
  return runs.get(runId) ?? null;
}

export async function updateRunStatus(
  runId: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  const run = runs.get(runId);
  if (run) {
    run.status = status;
    run.updated_at = new Date().toISOString();
    Object.assign(run, extra);
  }
}

export async function getRunsForClaim(claimId: string) {
  return [...runs.values()]
    .filter((r) => r.claim_id === claimId)
    .sort((a, b) => (a.started_at as string).localeCompare(b.started_at as string));
}

// --- RunEvents ---

export async function putRunEvent(event: Record<string, unknown>) {
  const runId = event.run_id as string;
  if (!runEvents.has(runId)) runEvents.set(runId, []);
  runEvents.get(runId)!.push({ ...event });
}

export async function getRunEvents(runId: string, fromSeq = 0) {
  return (runEvents.get(runId) ?? []).filter((e) => (e.seq as number) > fromSeq);
}

// --- Agents ---

export async function putAgent(agent: Record<string, unknown>) {
  agents.set(agent.agent_id as string, { ...agent });
}

export async function getAgent(agentId: string) {
  return agents.get(agentId) ?? null;
}

export async function getAllAgents() {
  return [...agents.values()];
}

// --- Scan helpers (admin) ---

export async function scanClaims(limit = 50, _startKey?: Record<string, unknown>) {
  const items = [...claims.values()].slice(0, limit);
  return { items, lastKey: undefined };
}

export async function scanRuns(limit = 50, _startKey?: Record<string, unknown>) {
  const items = [...runs.values()].slice(0, limit);
  return { items, lastKey: undefined };
}

// --- IntakeJobs ---

const intakeJobs = new Map<string, Record<string, unknown>>();

export async function putIntakeJob(job: Record<string, unknown>) {
  intakeJobs.set(job.intake_job_id as string, { ...job });
}

export async function getIntakeJob(jobId: string) {
  return intakeJobs.get(jobId) ?? null;
}

export async function updateIntakeJob(jobId: string, updates: Record<string, unknown>) {
  const job = intakeJobs.get(jobId);
  if (job) Object.assign(job, updates, { updated_at: new Date().toISOString() });
}

export async function scanIntakeJobs(limit = 50) {
  return [...intakeJobs.values()].slice(0, limit);
}
