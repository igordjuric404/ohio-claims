import { ulid } from "ulid";
import { randomBytes } from "node:crypto";
import { runAgent } from "./client.js";
import { stageValidators } from "@ohio-claims/shared";
import * as db from "../storage/index.js";
import { computeEventHash, createEventSK } from "../lib/audit.js";
import { computePaymentDeadline } from "../compliance/clock.js";
import type { ClaimStage } from "@ohio-claims/shared";

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
  { fromStage: "FRAUD_DONE", agentId: "seniorreviewer", toStage: "FINAL_DECISION_DONE", validatorKey: "FINAL_DECISION_DONE" },
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

  const run: Record<string, unknown> = {
    run_id: runId,
    claim_id: claimId,
    stage: toStage,
    agent_id: agentId,
    status: "RUNNING",
    started_at: started.toISOString(),
    actor_id: actorId,
    trace_id: traceId,
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

  const claimSummary = JSON.stringify(claim, null, 2);
  const prompt = `Analyze this claim and produce your structured JSON output.\n\nClaim data:\n${claimSummary}`;

  let agentText: string;
  let agentModel: string | undefined;
  let agentUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

  try {
    const response = await runAgent(agentId, prompt, `pipeline-${claimId}`);
    agentText = response.text;
    agentModel = response.model;
    agentUsage = response.usage;
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

  let parsed: unknown;
  try {
    parsed = extractJson(agentText);
  } catch {
    const ended = new Date();
    const errMsg = `Agent ${agentId} returned invalid JSON`;
    await emitRunEvent("stage.failed", { error: errMsg, raw_snippet: agentText.substring(0, 200) });
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
  await emitRunEvent("stage.completed", { output_summary: Object.keys(parsed as object) });
  await db.updateRunStatus(runId, "SUCCEEDED", {
    ended_at: ended.toISOString(),
    duration_ms: ended.getTime() - started.getTime(),
    model: agentModel,
    usage: agentUsage,
  });

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

  claim = await db.getClaim(claimId);
  if (claim!.stage === "FINAL_DECISION_DONE") {
    const srOutput = result.stage_outputs["FINAL_DECISION_DONE"] as any;
    if (srOutput?.final_outcome === "approve") {
      const claimSummaryForFinance = JSON.stringify(claim, null, 2);

      const financeResult = await runStage(
        claimId, "finance", "PAID", "PAID",
        { ...claim!, _sr_decision: srOutput } as any,
        actorId, pipelineTraceId
      );
      result.run_ids.push(financeResult.runId);

      if (financeResult.ok) {
        result.stages_completed.push("PAID");
        result.stage_outputs["PAID"] = financeResult.output;
        const paymentDue = computePaymentDeadline(new Date());
      } else {
        result.errors.push(financeResult.error!);
      }
    } else {
      const eventCtx = { actor_id: actorId, trace_id: pipelineTraceId };
      await appendEvent(claimId, "CLOSED_NO_PAY", "STAGE_COMPLETED", {
        reason: srOutput?.final_outcome ?? "denied",
        rationale: srOutput?.rationale,
      }, eventCtx);
      await db.updateClaimStage(claimId, "CLOSED_NO_PAY");
      result.stages_completed.push("CLOSED_NO_PAY");
    }
  }

  claim = await db.getClaim(claimId);
  result.final_stage = claim!.stage as string;
  return result;
}
