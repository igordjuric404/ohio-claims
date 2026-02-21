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

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

async function appendEvent(claimId: string, stage: string, type: string, data: unknown) {
  const lastEvent = await db.getLastEvent(claimId);
  const prevHash = lastEvent?.hash as string | undefined;
  const eventSk = createEventSK(stage);
  const event = {
    claim_id: claimId,
    event_sk: eventSk,
    created_at: new Date().toISOString(),
    stage,
    type,
    data,
    prev_hash: prevHash,
    hash: "",
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
};

export async function runPipeline(claimId: string): Promise<PipelineResult> {
  const result: PipelineResult = {
    claim_id: claimId,
    final_stage: "",
    stages_completed: [],
    errors: [],
    stage_outputs: {},
  };

  let claim = await db.getClaim(claimId);
  if (!claim) {
    result.errors.push("Claim not found");
    return result;
  }

  for (const step of PIPELINE_STAGES) {
    if (claim!.stage !== step.fromStage) continue;

    await appendEvent(claimId, step.toStage, "STAGE_STARTED", { agent: step.agentId });

    const claimSummary = JSON.stringify(claim, null, 2);
    const prompt = `Analyze this claim and produce your structured JSON output.\n\nClaim data:\n${claimSummary}`;

    let agentText: string;
    try {
      const response = await runAgent(step.agentId, prompt, `pipeline-${claimId}`);
      agentText = response.text;
    } catch (err: any) {
      result.errors.push(`Agent ${step.agentId} call failed: ${err.message}`);
      await appendEvent(claimId, step.toStage, "STAGE_ERROR", { error: err.message });
      break;
    }

    let parsed: unknown;
    try {
      parsed = extractJson(agentText);
    } catch {
      result.errors.push(`Agent ${step.agentId} returned invalid JSON: ${agentText.substring(0, 200)}`);
      await appendEvent(claimId, step.toStage, "STAGE_ERROR", { error: "Invalid JSON", raw: agentText.substring(0, 500) });
      break;
    }

    const validator = stageValidators[step.validatorKey];
    if (validator) {
      const validation = validator(parsed);
      if (!validation.ok) {
        result.errors.push(`Agent ${step.agentId} output failed schema validation: ${JSON.stringify(validation.errors)}`);
        await appendEvent(claimId, step.toStage, "SCHEMA_VALIDATION_FAILED", {
          errors: validation.errors,
          raw_output: parsed,
        });
        break;
      }
    }

    await appendEvent(claimId, step.toStage, "STAGE_COMPLETED", parsed);
    await db.updateClaimStage(claimId, step.toStage);
    result.stages_completed.push(step.toStage);
    result.stage_outputs[step.toStage] = parsed;

    claim = await db.getClaim(claimId);
  }

  // Handle finance stage (conditional on senior reviewer outcome)
  claim = await db.getClaim(claimId);
  if (claim!.stage === "FINAL_DECISION_DONE") {
    const srOutput = result.stage_outputs["FINAL_DECISION_DONE"] as any;
    if (srOutput?.final_outcome === "approve") {
      await appendEvent(claimId, "PAID", "STAGE_STARTED", { agent: "finance" });

      const claimSummary = JSON.stringify(claim, null, 2);
      const prompt = `Execute payment for this approved claim.\n\nClaim data:\n${claimSummary}\n\nSenior Reviewer Decision:\n${JSON.stringify(srOutput, null, 2)}`;

      try {
        const response = await runAgent("finance", prompt, `pipeline-${claimId}`);
        const parsed = extractJson(response.text);

        const validator = stageValidators["PAID"];
        if (validator) {
          const validation = validator(parsed);
          if (!validation.ok) {
            result.errors.push(`Finance output failed schema validation: ${JSON.stringify(validation.errors)}`);
            await appendEvent(claimId, "PAID", "SCHEMA_VALIDATION_FAILED", { errors: validation.errors, raw_output: parsed });
          } else {
            await appendEvent(claimId, "PAID", "STAGE_COMPLETED", parsed);
            await db.updateClaimStage(claimId, "PAID");
            result.stages_completed.push("PAID");
            result.stage_outputs["PAID"] = parsed;

            const paymentDue = computePaymentDeadline(new Date());
            await db.updateClaimStage(claimId, "PAID");
          }
        }
      } catch (err: any) {
        result.errors.push(`Finance agent failed: ${err.message}`);
        await appendEvent(claimId, "PAID", "STAGE_ERROR", { error: err.message });
      }
    } else {
      await appendEvent(claimId, "CLOSED_NO_PAY", "STAGE_COMPLETED", {
        reason: srOutput?.final_outcome ?? "denied",
        rationale: srOutput?.rationale,
      });
      await db.updateClaimStage(claimId, "CLOSED_NO_PAY");
      result.stages_completed.push("CLOSED_NO_PAY");
    }
  }

  claim = await db.getClaim(claimId);
  result.final_stage = claim!.stage as string;
  return result;
}
