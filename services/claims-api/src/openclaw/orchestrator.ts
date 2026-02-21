import { ulid } from "ulid";
import { randomBytes } from "node:crypto";
import { runAgent, loadSystemPrompt, webSearchForPricing, analyzeImagesWithVision, type AgentCallOptions, type ImagePart } from "./client.js";
import { judgeProducerOutput, type JudgeStageResult } from "./judge.js";
import { stageValidators } from "@ohio-claims/shared";
import * as db from "../storage/index.js";
import { listByPrefix, getObjectAsBase64 } from "../storage/s3.js";
import { computeEventHash, createEventSK } from "../lib/audit.js";
import { decrypt } from "../crypto/encrypt.js";
import type { ClaimStage, JudgeReport } from "@ohio-claims/shared";

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

const ENABLE_JUDGES = process.env.ENABLE_JUDGES !== "false";

export type PipelineResult = {
  claim_id: string;
  final_stage: string;
  stages_completed: string[];
  errors: string[];
  stage_outputs: Record<string, unknown>;
  run_ids: string[];
  judge_reports?: Record<string, JudgeReport>;
};

async function runStage(
  claimId: string,
  agentId: string,
  toStage: string,
  validatorKey: string,
  claim: Record<string, unknown>,
  actorId: string,
  pipelineTraceId: string,
  imageAnalysis?: Record<string, unknown>,
): Promise<{ ok: boolean; output?: unknown; error?: string; runId: string }> {
  const runId = ulid();
  const traceId = pipelineTraceId;
  const started = new Date();

  const decryptedClaim = decryptClaimForAgent(claim);
  const claimSummary = JSON.stringify(decryptedClaim, null, 2);

  let pricingResearch = "";
  let pricingCitations: { url: string; title?: string }[] = [];

  if (AGENTS_NEEDING_WEB_SEARCH.has(agentId)) {
    const vehicle = decryptedClaim.vehicle as Record<string, unknown> | undefined;
    const loss = decryptedClaim.loss as Record<string, unknown> | undefined;
    const year = vehicle?.year ?? "";
    const make = vehicle?.make ?? "";
    const model = vehicle?.model ?? "";
    const city = loss?.city ?? "";
    const state = loss?.state ?? "OH";

    const damagedComponents = Array.isArray(imageAnalysis?.damaged_components)
      ? (imageAnalysis!.damaged_components as string[]).join(", ")
      : (loss?.description as string) ?? "";

    const searchQuery = `Find current 2024-2026 auto parts prices and body shop labor rates:\n\nVehicle: ${year} ${make} ${model}\nLocation: ${city}, ${state}\nDamaged components identified by image analysis: ${damagedComponents}\n\nSearch for:\n1. Price of each damaged part (OEM and aftermarket) for this specific vehicle\n2. Auto body shop labor rate per hour in ${city}, ${state}\n3. If extensive damage, the vehicle's current market value\n\nFor each result, provide the price, the part name, and the URL where you found it.`;

    try {
      const searchResponse = await webSearchForPricing(searchQuery);
      pricingResearch = searchResponse.text;
      pricingCitations = searchResponse.citations ?? [];
    } catch (err: any) {
      pricingResearch = `Web search failed: ${err.message}. Estimate based on your knowledge.`;
    }
  }

  let prompt: string;
  const imageAnalysisSummary = imageAnalysis
    ? `\n\n--- IMAGE ANALYSIS RESULTS ---\n${JSON.stringify(imageAnalysis, null, 2)}\n--- END IMAGE ANALYSIS ---\n`
    : "";

  if (pricingResearch) {
    prompt = `Here is real-time web research data with current auto parts prices and labor rates:\n\n--- WEB RESEARCH RESULTS ---\n${pricingResearch}\n--- END WEB RESEARCH ---${imageAnalysisSummary}\nNow analyze the claim below using the REAL prices from the web research above. Put the actual URLs from the research into pricing_sources.\n\nClaim data:\n${claimSummary}`;
  } else {
    prompt = `Analyze this claim and produce your structured JSON output.${imageAnalysisSummary}\n\nClaim data:\n${claimSummary}`;
  }
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

  if (pricingResearch) {
    await emitRunEvent("web_search.results", {
      research_text: truncate(pricingResearch, 5000),
      citation_count: pricingCitations.length,
      citation_urls: pricingCitations.map(c => c.url),
    });
  }

  await emitRunEvent("agent.input", {
    system_prompt: truncate(systemPrompt, 3000),
    prompt: truncate(prompt, 3000),
  });

  let agentText: string;
  let agentModel: string | undefined;
  let agentUsage: any;
  let agentReasoning: string | undefined;
  let agentCitations: { url: string; title?: string }[] | undefined;

  const callOptions: AgentCallOptions = {};
  if (AGENTS_NEEDING_REASONING.has(agentId)) {
    callOptions.enableReasoning = true;
  }

  try {
    const response = await runAgent(agentId, prompt, `pipeline-${claimId}`, callOptions);
    agentText = response.text;
    agentModel = response.model;
    agentUsage = response.usage;
    agentReasoning = response.reasoning;
    agentCitations = response.citations;
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

  const allCitations = [...pricingCitations, ...(agentCitations ?? [])];
  if (allCitations.length > 0 && parsed && typeof parsed === "object") {
    const out = parsed as Record<string, unknown>;
    const seen = new Set<string>();
    const citationUrls: string[] = [];
    for (const c of allCitations) {
      if (!seen.has(c.url)) {
        seen.add(c.url);
        citationUrls.push(c.title ? `${c.url} — ${c.title}` : c.url);
      }
    }
    const existingSources = Array.isArray(out.pricing_sources) ? out.pricing_sources as string[] : [];
    const existingUrls = existingSources.filter(s => typeof s === "string" && s.startsWith("http"));
    const combined = [...new Set([...citationUrls, ...existingUrls])];
    if (combined.length > 0) {
      out.pricing_sources = combined;
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
  if (agentCitations) {
    runUpdateData.citations = agentCitations;
  }
  await db.updateRunStatus(runId, "SUCCEEDED", runUpdateData);

  await appendEvent(claimId, toStage, "STAGE_COMPLETED", parsed, eventCtx);
  await db.updateClaimStage(claimId, toStage);

  return { ok: true, output: parsed, runId };
}

type ImageAnalysisResult = {
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
  runId: string;
};

async function runImageAnalysis(
  claimId: string,
  claim: Record<string, unknown>,
  actorId: string,
  pipelineTraceId: string
): Promise<ImageAnalysisResult> {
  const runId = ulid();
  const started = new Date();
  const vehicle = claim.vehicle as Record<string, unknown> | undefined;
  const vehicleStr = `${vehicle?.year ?? "?"} ${vehicle?.make ?? "?"} ${vehicle?.model ?? "?"}`;

  const run: Record<string, unknown> = {
    run_id: runId,
    claim_id: claimId,
    stage: "ASSESSMENT_DONE",
    agent_id: "image_analyzer",
    status: "RUNNING",
    started_at: started.toISOString(),
    actor_id: actorId,
    trace_id: pipelineTraceId,
    input_prompt: `Image analysis for ${vehicleStr}`,
  };
  await db.putRun(run);

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

  try {
    let photoKeys: string[] = [];
    try {
      photoKeys = await listByPrefix(`claims/${claimId}/damage_photos/`);
    } catch {
      photoKeys = [];
    }

    if (photoKeys.length === 0) {
      const noPhotosOutput = {
        image_descriptions: [],
        damaged_components: [],
        overall_assessment: "No damage photos available. Assessment based on text description only.",
        estimated_labor_hours: null,
        total_loss_indicators: null,
        confidence: 0,
      };
      const ended = new Date();
      await db.updateRunStatus(runId, "SUCCEEDED", {
        ended_at: ended.toISOString(),
        duration_ms: ended.getTime() - started.getTime(),
        output_json: noPhotosOutput,
      });
      return { ok: true, output: noPhotosOutput, runId };
    }

    const images: ImagePart[] = [];
    for (const key of photoKeys.slice(0, 8)) {
      const result = await getObjectAsBase64(key);
      if (result) {
        images.push({
          base64: result.base64,
          mimeType: result.mimeType,
          filename: key.split("/").pop() ?? key,
        });
      }
    }

    if (images.length === 0) {
      throw new Error("Could not read any damage photos from storage.");
    }

    await emitRunEvent("stage.started", { agent_id: "image_analyzer", photos: images.length });

    const systemPrompt = loadSystemPrompt("image_analyzer");
    const textPrompt = `Analyze ${images.length} damage photo(s) for a ${vehicleStr}. Photos are labeled by index (0-based). Describe the damage visible in each photo and identify all damaged components.`;

    const response = await analyzeImagesWithVision(systemPrompt, textPrompt, images);

    await emitRunEvent("agent.response", { model: response.model, usage: response.usage });

    let parsed: Record<string, unknown>;
    try {
      let cleaned = response.text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      throw new Error(`Image analyzer returned invalid JSON: ${response.text.substring(0, 200)}`);
    }

    if (Array.isArray(parsed.image_descriptions)) {
      for (const desc of parsed.image_descriptions as any[]) {
        const idx = desc.image_index ?? 0;
        if (idx < images.length) {
          desc.filename = images[idx].filename;
        }
      }
    }

    const ended = new Date();
    await emitRunEvent("stage.completed", parsed);
    await db.updateRunStatus(runId, "SUCCEEDED", {
      ended_at: ended.toISOString(),
      duration_ms: ended.getTime() - started.getTime(),
      model: response.model,
      usage: response.usage,
      output_json: parsed,
    });

    return { ok: true, output: parsed, runId };
  } catch (err: any) {
    const ended = new Date();
    await emitRunEvent("stage.failed", { error: err.message });
    await db.updateRunStatus(runId, "FAILED", {
      ended_at: ended.toISOString(),
      duration_ms: ended.getTime() - started.getTime(),
      error: err.message,
    });
    const fallback = {
      image_descriptions: [],
      damaged_components: [],
      overall_assessment: `Image analysis failed: ${err.message}. Assessment based on text description only.`,
      estimated_labor_hours: null,
      total_loss_indicators: null,
      confidence: 0,
    };
    return { ok: true, output: fallback, runId };
  }
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
    judge_reports: {},
  };

  let claim = await db.getClaim(claimId);
  if (!claim) {
    result.errors.push("Claim not found");
    return result;
  }

  let imageAnalysisOutput: Record<string, unknown> | undefined;

  for (const step of PIPELINE_STAGES) {
    if (claim!.stage !== step.fromStage) continue;

    if (step.agentId === "assessor") {
      const imageResult = await runImageAnalysis(claimId, claim!, actorId, pipelineTraceId);
      result.run_ids.push(imageResult.runId);
      if (imageResult.output) {
        imageAnalysisOutput = imageResult.output;
        result.stage_outputs["IMAGE_ANALYSIS"] = imageResult.output;
      }
    }

    const stageResult = await runStage(
      claimId, step.agentId, step.toStage, step.validatorKey,
      claim!, actorId, pipelineTraceId,
      imageAnalysisOutput,
    );
    result.run_ids.push(stageResult.runId);

    if (!stageResult.ok) {
      result.errors.push(stageResult.error!);
      break;
    }

    result.stages_completed.push(step.toStage);
    result.stage_outputs[step.toStage] = stageResult.output;

    if (ENABLE_JUDGES && stageResult.output) {
      try {
        const decryptedClaim = decryptClaimForAgent(claim as Record<string, unknown>);
        const judgeResult = await judgeProducerOutput(
          step.agentId,
          claimId,
          decryptedClaim,
          stageResult.output,
          undefined,
          stageResult.runId,
        );
        result.judge_reports![step.agentId] = judgeResult.report;

        await appendEvent(claimId, step.toStage, "JUDGE_COMPLETED", {
          agent_id: step.agentId,
          verdict: judgeResult.report.final_verdict,
          scores: judgeResult.report.final_scores,
          total_rounds: judgeResult.report.total_rounds,
          accepted: judgeResult.accepted,
        }, { run_id: stageResult.runId, actor_id: actorId, trace_id: pipelineTraceId });
      } catch (err: any) {
        await appendEvent(claimId, step.toStage, "JUDGE_FAILED", {
          agent_id: step.agentId,
          error: err.message,
        }, { run_id: stageResult.runId, actor_id: actorId, trace_id: pipelineTraceId });
      }
    }

    claim = await db.getClaim(claimId);
  }

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
