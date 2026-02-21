import { ulid } from "ulid";
import { randomBytes } from "node:crypto";
import { runAgent, loadSystemPrompt, type AgentCallOptions } from "./client.js";
import { stageValidators } from "@ohio-claims/shared";
import * as db from "../storage/index.js";
import { computeEventHash, createEventSK } from "../lib/audit.js";
import { decrypt } from "../crypto/encrypt.js";
import type { ClaimStage } from "@ohio-claims/shared";

const AGENTS_NEEDING_REASONING = new Set(["claimsofficer", "assessor", "fraudanalyst"]);

const WEB_SEARCH_MODEL = process.env.WEB_SEARCH_MODEL ?? "google/gemini-2.0-flash-001:online";
const AGENTS_NEEDING_WEB_SEARCH = new Set(["assessor"]);

const PIPELINE_STAGES: Array<{
  fromStage: ClaimStage;
  agentId: string;
  toStage: ClaimStage;
  validatorKey: string;
}> = [
  { fromStage: "FNOL_SUBMITTED", agentId: "frontdesk", toStage: "FRONTDESK_DONE", validatorKey: "FRONTDESK_DONE" },
  { fromStage: "FRONTDESK_DONE", agentId: "claimsofficer", toStage: "COVERAGE_DONE", validatorKey: "COVERAGE_DONE" },
  { fromStage: "COVERAGE_DONE", agentId: "assessor", toStage: "ASSESSMENT_DONE", validatorKey: "ASSESSMENT_DONE" },
  { fromStage: "ASSESSMENT_DONE", agentId: "fraudanalyst", toStage: "FRAUD_DONE", validatorKey: "FRAUD_DONE" },
];

function generateTraceId(): string {
  return randomBytes(16).toString("hex");
}

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + "... [truncated]" : s;
}

function tryDecrypt(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

function decryptClaimForAgent(claim: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...claim };
  if (copy.claimant && typeof copy.claimant === "object") {
    const c = copy.claimant as Record<string, unknown>;
    copy.claimant = {
      full_name: tryDecrypt(c.full_name),
      phone: tryDecrypt(c.phone),
      email: c.email ? tryDecrypt(c.email) : undefined,
      address: c.address ? tryDecrypt(c.address) : undefined,
    };
  }
  if (copy.vehicle && typeof copy.vehicle === "object") {
    const v = copy.vehicle as Record<string, unknown>;
    copy.vehicle = {
      ...v,
      vin: v.vin ? tryDecrypt(v.vin) : undefined,
    };
  }
  return copy;
}

async function appendEvent(
  claimId: string,
  stage: string,
  type: string,
  data: unknown,
  extra: { run_id?: string; actor_id?: string; trace_id?: string } = {}
) {
  const lastEvent = await db.getLastEvent(claimId);
  const prevHash = lastEvent?.hash as string | undefined;
  const eventSk = createEventSK(stage);
  const event: Record<string, unknown> = {
    claim_id: claimId,
    event_sk: eventSk,
    created_at: new Date().toISOString(),
    stage,
    type,
    data,
    prev_hash: prevHash,
    hash: "",
    ...extra,
  };
  event.hash = computeEventHash(event);
  await db.putEvent(event);
  return event;
}

export type PipelineResult = {
  claim_id: string;
  final_stage: string;
  stages_completed: string[];
  errors: string[];
  stage_outputs: Record<string, unknown>;
  run_ids: string[];
};

async function runStage(
  claimId: string,
  agentId: string,
  toStage: string,
  validatorKey: string,
  claim: Record<string, unknown>,
  actorId: string,
  pipelineTraceId: string
): Promise<{ ok: boolean; output?: unknown; error?: string; runId: string }> {
  const runId = ulid();
  const traceId = pipelineTraceId;
  const started = new Date();

  const decryptedClaim = decryptClaimForAgent(claim);
  const claimSummary = JSON.stringify(decryptedClaim, null, 2);
  const prompt = `Analyze this claim and produce your structured JSON output.\n\nClaim data:\n${claimSummary}`;
  const systemPrompt = loadSystemPrompt(agentId);

  const run: Record<string, unknown> = {
    run_id: runId,
    claim_id: claimId,
    stage: toStage,
    agent_id: agentId,
    status: "RUNNING",
    started_at: started.toISOString(),
    actor_id: actorId,
    trace_id: traceId,
    input_prompt: truncate(prompt, 4000),
  };
  await db.putRun(run);

  const eventCtx = { run_id: runId, actor_id: actorId, trace_id: traceId };
  await appendEvent(claimId, toStage, "STAGE_STARTED", { agent: agentId, run_id: runId }, eventCtx);

  let seqCounter = 1;
  const emitRunEvent = async (eventType: string, payload: unknown) => {
    await db.putRunEvent({
      run_id: runId,
      seq: seqCounter++,
      ts: new Date().toISOString(),
      event_type: eventType,
      payload,
    });
  };

  await emitRunEvent("stage.started", { agent_id: agentId, claim_id: claimId, stage: toStage });

  await emitRunEvent("agent.input", {
    system_prompt: truncate(systemPrompt, 3000),
    prompt: truncate(prompt, 3000),
  });

  let agentText: string;
  let agentModel: string | undefined;
  let agentUsage: any;
  let agentReasoning: string | undefined;

  const callOptions: AgentCallOptions = {};
  if (AGENTS_NEEDING_REASONING.has(agentId)) {
    callOptions.enableReasoning = true;
  }
  if (AGENTS_NEEDING_WEB_SEARCH.has(agentId)) {
    callOptions.model = WEB_SEARCH_MODEL;
  }

  try {
    const response = await runAgent(agentId, prompt, `pipeline-${claimId}`, callOptions);
    agentText = response.text;
    agentModel = response.model;
    agentUsage = response.usage;
    agentReasoning = response.reasoning;
  } catch (err: any) {
    const ended = new Date();
    await emitRunEvent("stage.failed", { error: err.message });
    await db.updateRunStatus(runId, "FAILED", {
      ended_at: ended.toISOString(),
      duration_ms: ended.getTime() - started.getTime(),
      error: err.message,
    });
    await appendEvent(claimId, toStage, "STAGE_ERROR", { error: err.message, run_id: runId }, eventCtx);
    return { ok: false, error: `Agent ${agentId} call failed: ${err.message}`, runId };
  }

  await emitRunEvent("agent.response", { model: agentModel, usage: agentUsage });
  await emitRunEvent("agent.raw_output", { raw_text: truncate(agentText, 5000) });

  let parsed: unknown;
  try {
    parsed = extractJson(agentText);
  } catch {
    const ended = new Date();
    const errMsg = `Agent ${agentId} returned invalid JSON`;
    await emitRunEvent("stage.failed", { error: errMsg, raw_snippet: agentText.substring(0, 500) });
    await db.updateRunStatus(runId, "FAILED", {
      ended_at: ended.toISOString(),
      duration_ms: ended.getTime() - started.getTime(),
      error: errMsg,
    });
    await appendEvent(claimId, toStage, "STAGE_ERROR", { error: errMsg, raw: agentText.substring(0, 500), run_id: runId }, eventCtx);
    return { ok: false, error: `${errMsg}: ${agentText.substring(0, 200)}`, runId };
  }

  const validator = stageValidators[validatorKey];
  if (validator) {
    const validation = validator(parsed);
    if (!validation.ok) {
      const ended = new Date();
      const errMsg = `Agent ${agentId} output failed schema validation`;
      await emitRunEvent("stage.failed", { error: errMsg, validation_errors: validation.errors });
      await db.updateRunStatus(runId, "FAILED", {
        ended_at: ended.toISOString(),
        duration_ms: ended.getTime() - started.getTime(),
        error: errMsg,
      });
      await appendEvent(claimId, toStage, "SCHEMA_VALIDATION_FAILED", { errors: validation.errors, raw_output: parsed, run_id: runId }, eventCtx);
      return { ok: false, error: `${errMsg}: ${JSON.stringify(validation.errors)}`, runId };
    }
  }

  const ended = new Date();
  await emitRunEvent("stage.completed", parsed);
  const runUpdateData: Record<string, unknown> = {
    ended_at: ended.toISOString(),
    duration_ms: ended.getTime() - started.getTime(),
    model: agentModel,
    usage: agentUsage,
    output_json: parsed,
  };
  if (agentReasoning) {
    runUpdateData.reasoning = agentReasoning;
  }
  await db.updateRunStatus(runId, "SUCCEEDED", runUpdateData);

  await appendEvent(claimId, toStage, "STAGE_COMPLETED", parsed, eventCtx);
  await db.updateClaimStage(claimId, toStage);

  return { ok: true, output: parsed, runId };
}

export async function runPipeline(claimId: string, actorId = "system"): Promise<PipelineResult> {
  const pipelineTraceId = generateTraceId();

  const result: PipelineResult = {
    claim_id: claimId,
    final_stage: "",
    stages_completed: [],
    errors: [],
    stage_outputs: {},
    run_ids: [],
  };

  let claim = await db.getClaim(claimId);
  if (!claim) {
    result.errors.push("Claim not found");
    return result;
  }

  for (const step of PIPELINE_STAGES) {
    if (claim!.stage !== step.fromStage) continue;

    const stageResult = await runStage(
      claimId, step.agentId, step.toStage, step.validatorKey,
      claim!, actorId, pipelineTraceId
    );
    result.run_ids.push(stageResult.runId);

    if (!stageResult.ok) {
      result.errors.push(stageResult.error!);
      break;
    }

    result.stages_completed.push(step.toStage);
    result.stage_outputs[step.toStage] = stageResult.output;
    claim = await db.getClaim(claimId);
  }

  // After all agent stages complete, transition to PENDING_REVIEW for human decision
  claim = await db.getClaim(claimId);
  if (claim!.stage === "FRAUD_DONE") {
    const eventCtx = { actor_id: actorId, trace_id: pipelineTraceId };
    await appendEvent(claimId, "PENDING_REVIEW", "STAGE_COMPLETED", {
      message: "Automated pipeline complete. Awaiting human reviewer decision.",
    }, eventCtx);
    await db.updateClaimStage(claimId, "PENDING_REVIEW");
    result.stages_completed.push("PENDING_REVIEW");
  }

  claim = await db.getClaim(claimId);
  result.final_stage = claim!.stage as string;
  return result;
}

/**
 * Run the finance agent after a human reviewer approves a claim.
 * Called from the reviewer decision endpoint, not from the automated pipeline.
 */
export async function runFinanceStage(claimId: string, reviewerDecision: Record<string, unknown>, actorId = "reviewer"): Promise<{ ok: boolean; output?: unknown; error?: string; runId?: string }> {
  const pipelineTraceId = generateTraceId();
  const claim = await db.getClaim(claimId);
  if (!claim) return { ok: false, error: "Claim not found" };

  const financeResult = await runStage(
    claimId, "finance", "PAID", "PAID",
    { ...claim, _reviewer_decision: reviewerDecision } as any,
    actorId, pipelineTraceId
  );

  if (!financeResult.ok) {
    return { ok: false, error: financeResult.error, runId: financeResult.runId };
  }

  return { ok: true, output: financeResult.output, runId: financeResult.runId };
}
