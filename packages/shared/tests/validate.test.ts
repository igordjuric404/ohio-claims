import { describe, it, expect } from "vitest";
import {
  validateFrontDesk,
  validateClaimsOfficer,
  validateAssessor,
  validateFraudAnalyst,
  validateSeniorReviewer,
  validateFinance,
} from "../src/schemas/index.js";

describe("FrontDesk schema", () => {
  it("accepts valid output", () => {
    const result = validateFrontDesk({
      triage_category: "standard",
      missing_items: ["police_report"],
      compliance: {
        ack_due_at: "2026-03-08T00:00:00Z",
        deadlines_met: true,
        next_required_action: "Send acknowledgement letter",
      },
      confidence: 0.85,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid triage category", () => {
    const result = validateFrontDesk({
      triage_category: "invalid",
      missing_items: [],
      compliance: { ack_due_at: "x", deadlines_met: true, next_required_action: "n/a" },
      confidence: 0.5,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = validateFrontDesk({ triage_category: "fast_track" });
    expect(result.ok).toBe(false);
  });

  it("rejects extra properties", () => {
    const result = validateFrontDesk({
      triage_category: "standard",
      missing_items: [],
      compliance: { ack_due_at: "x", deadlines_met: true, next_required_action: "n/a" },
      confidence: 0.5,
      extra_field: true,
    });
    expect(result.ok).toBe(false);
  });
});

describe("ClaimsOfficer schema", () => {
  it("accepts valid output", () => {
    const result = validateClaimsOfficer({
      coverage_status: "covered",
      deductible: 500,
      limits: 50000,
      proof_of_loss_needed: false,
      compliance: {
        accept_deny_deadline: "2026-03-14T00:00:00Z",
        deadlines_met: true,
        next_required_action: "Proceed to assessment",
      },
      confidence: 0.9,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid coverage status", () => {
    const result = validateClaimsOfficer({
      coverage_status: "maybe",
      proof_of_loss_needed: true,
      compliance: { accept_deny_deadline: "x", deadlines_met: true, next_required_action: "n/a" },
      confidence: 0.5,
    });
    expect(result.ok).toBe(false);
  });
});

describe("Assessor schema", () => {
  it("accepts valid output", () => {
    const result = validateAssessor({
      repair_estimate_low: 2000,
      repair_estimate_high: 4500,
      total_loss_recommended: false,
      tax_reimbursement_eligible: false,
      compliance: { estimate_provided: true, deadlines_met: true, next_required_action: "Await fraud check" },
      confidence: 0.75,
    });
    expect(result.ok).toBe(true);
  });
});

describe("FraudAnalyst schema", () => {
  it("accepts valid output", () => {
    const result = validateFraudAnalyst({
      risk_score: 15,
      flags: [],
      recommendation: "normal",
      compliance: { deadlines_met: true, next_required_action: "Proceed to senior review" },
      confidence: 0.92,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects risk_score > 100", () => {
    const result = validateFraudAnalyst({
      risk_score: 150,
      flags: [],
      recommendation: "normal",
      compliance: { deadlines_met: true, next_required_action: "x" },
      confidence: 0.5,
    });
    expect(result.ok).toBe(false);
  });
});

describe("SeniorReviewer schema", () => {
  it("accepts valid output", () => {
    const result = validateSeniorReviewer({
      final_outcome: "approve",
      rationale: "All stages pass, coverage confirmed, no fraud flags.",
      approve_amount_cap: 4500,
      required_actions: ["Issue payment within 10 business days"],
      needs_human_review: false,
      compliance: { all_stages_complete: true, deadlines_met: true, next_required_action: "Payment" },
      confidence: 0.88,
    });
    expect(result.ok).toBe(true);
  });
});

describe("Finance schema", () => {
  it("accepts valid output", () => {
    const result = validateFinance({
      payment_status: "disbursed",
      amount: 3200,
      payee: "John Doe",
      ledger_entry_id: "LED-001",
      receipt_ref: "REC-001",
      compliance: { payment_due_at: "2026-03-01T00:00:00Z", deadlines_met: true, next_required_action: "Close claim" },
      confidence: 0.95,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects invalid payment_status", () => {
    const result = validateFinance({
      payment_status: "pending",
      compliance: { deadlines_met: true, next_required_action: "x" },
      confidence: 0.5,
    });
    expect(result.ok).toBe(false);
  });
});
