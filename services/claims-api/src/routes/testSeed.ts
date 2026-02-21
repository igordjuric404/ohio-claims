import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { computeDeadlines } from "../compliance/clock.js";
import { computeEventHash, createEventSK } from "../lib/audit.js";
import * as db from "../storage/index.js";

const STAGE_DATA = [
  {
    agent_id: "frontdesk",
    stage: "FRONTDESK_DONE",
    output: {
      triage_priority: "medium",
      missing_documents: [],
      summary: "Standard collision claim. All required documents present.",
      compliance: { deadlines_met: true, next_required_action: "coverage_verification" },
    },
    reasoning: null,
  },
  {
    agent_id: "claimsofficer",
    stage: "COVERAGE_DONE",
    output: {
      policy_active: true,
      coverage_confirmed: true,
      deductible: 500,
      coverage_limit: 50000,
      exclusions_applicable: false,
      notes: "Policy POL-OH-2024-83921 is active with comprehensive collision coverage. $500 deductible applies. Coverage limit of $50,000 is well above expected claim value. No exclusions apply to this type of loss event.",
      compliance: { deadlines_met: true, next_required_action: "damage_assessment" },
    },
    reasoning: "Reviewed policy POL-OH-2024-83921 against the reported loss. The policy includes comprehensive collision coverage with a $500 deductible. The incident (rear-end collision at an intersection) falls within standard covered events. No exclusionary clauses apply — the driver was not at fault, and the vehicle was being operated within policy terms.",
  },
  {
    agent_id: "assessor",
    stage: "ASSESSMENT_DONE",
    output: {
      repair_estimate_low: 2800,
      repair_estimate_high: 3500,
      total_loss_recommended: false,
      damaged_components: ["front bumper cover", "headlight assembly", "fender"],
      assessment_notes: "Based on web search pricing: 2023 Honda Accord front bumper cover ($280–$450 aftermarket, $580–$720 OEM), headlight assembly ($190–$350 aftermarket, $450–$680 OEM), fender ($180–$300 aftermarket, $380–$520 OEM). Columbus OH body shop labor rate: $65–$75/hr. Estimated 8–12 labor hours for R&R and paint.",
      valuation_method: null,
      actual_cash_value: null,
      betterment_deductions: null,
      parts_compliance_note: "Estimate uses like kind and quality parts per ORC 1345.81. OEM and aftermarket options provided.",
      tax_reimbursement_eligible: false,
      pricing_sources: [
        "https://www.carparts.com/bumper-cover/honda/accord",
        "https://www.rockauto.com/en/catalog/honda/2023/accord",
        "https://www.aaa.com/autorepair/articles/average-labor-rates"
      ],
      compliance: { deadlines_met: true, estimate_provided: true, next_required_action: "Schedule vehicle inspection at Buckeye Auto Body." },
      confidence: 0.85,
    },
    reasoning: "Analyzed the reported damage against known repair costs for 2023 Honda Accord. Front bumper replacement ($800–$1,100), headlight assembly ($600–$900), and fender repair ($400–$600). Labor estimated at $1,000–$900. Total repair range $2,800–$3,500. Vehicle value approximately $28,000 — repair cost is well below total loss threshold (typically 75% of value), so total loss is not recommended.",
  },
  {
    agent_id: "fraudanalyst",
    stage: "FRAUD_DONE",
    output: {
      fraud_risk_score: 0.12,
      risk_level: "low",
      red_flags: [],
      recommendation: "proceed",
      analysis_notes: "No fraud indicators detected. Police report corroborates claimant's account. Other driver was cited. No prior suspicious claims on this policy. Damage description is consistent with the reported incident type.",
      compliance: { deadlines_met: true },
    },
    reasoning: "Evaluated claim across multiple fraud indicators: timing, damage consistency, prior claim history, police involvement, and witness statements. All indicators are clean — police report filed (CPD #2026-0215-4472), other driver cited for running red light, no prior claims on this policy in 3 years, and damage patterns are consistent with a front-impact collision. Risk score: 0.12 (low). Recommendation: proceed with claim processing.",
  },
];

export async function testSeedRoutes(app: FastifyInstance) {
  if (process.env.USE_MEMORY_STORAGE !== "true") return;

  app.post("/internal/test/seed-reviewed-claim", async (req) => {
    const claimId = `CLM-${nanoid(12)}`;
    const now = new Date();
    const deadlines = computeDeadlines(now);

    const claim = {
      claim_id: claimId,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      policy_id: "POL-OH-2024-83921",
      claimant: {
        full_name: "Sarah Mitchell",
        phone: "(614) 555-0237",
        email: "sarah.mitchell@email.com",
        address: "782 Maple Ridge Dr, Columbus, OH 43215",
      },
      loss: {
        date_of_loss: "2026-02-18",
        state: "OH",
        city: "Columbus",
        description:
          "Was driving eastbound on Broad Street when another vehicle ran a red light at the intersection of 4th Street and collided with the front-right quarter panel. Police report filed (CPD #2026-0215-4472). Other driver cited.",
      },
      vehicle: { vin: "1HGCV1F34PA027839", year: 2023, make: "Honda", model: "Accord" },
      stage: "PENDING_REVIEW",
      compliance: { ack_due_at: deadlines.ack_due_at },
    };

    await db.putClaim(claim);

    const fnolEvent: Record<string, unknown> = {
      claim_id: claimId,
      event_sk: createEventSK("FNOL"),
      created_at: now.toISOString(),
      stage: "FNOL_SUBMITTED",
      type: "CLAIM_CREATED",
      data: { policy_id: claim.policy_id },
      prev_hash: undefined,
      hash: "",
    };
    fnolEvent.hash = computeEventHash(fnolEvent);
    await db.putEvent(fnolEvent);

    let prevHash = fnolEvent.hash as string;

    for (const stage of STAGE_DATA) {
      const runId = `run-seed-${stage.agent_id}-${nanoid(6)}`;
      const runStarted = new Date(now.getTime() + 1000).toISOString();
      const runEnded = new Date(now.getTime() + 2000).toISOString();

      await db.putRun({
        run_id: runId,
        claim_id: claimId,
        agent_id: stage.agent_id,
        stage: stage.stage,
        status: "COMPLETED",
        started_at: runStarted,
        ended_at: runEnded,
        duration_ms: 1000,
        input_prompt: `Process claim ${claimId} for stage ${stage.stage}`,
        output_json: stage.output,
        reasoning: stage.reasoning,
        model: "test-model",
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      const stageEvent: Record<string, unknown> = {
        claim_id: claimId,
        event_sk: createEventSK(stage.stage),
        created_at: runEnded,
        stage: stage.stage,
        type: "STAGE_COMPLETED",
        data: stage.output,
        prev_hash: prevHash,
        hash: "",
      };
      stageEvent.hash = computeEventHash(stageEvent);
      await db.putEvent(stageEvent);
      prevHash = stageEvent.hash as string;
    }

    return { claim_id: claimId, stage: "PENDING_REVIEW" };
  });
}
