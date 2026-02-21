import { describe, it, expect } from "vitest";
import { fieldLabel, formatFieldValue, formatCurrency, formatCurrencyRange } from "../fieldLabels";

describe("fieldLabel", () => {
  it("returns mapped label for known fields", () => {
    expect(fieldLabel("repair_estimate_low")).toBe("Repair Estimate (Low)");
    expect(fieldLabel("total_loss_recommended")).toBe("Total Loss Recommended");
    expect(fieldLabel("coverage_status")).toBe("Coverage Status");
    expect(fieldLabel("risk_score")).toBe("Risk Score");
    expect(fieldLabel("final_outcome")).toBe("Final Outcome");
  });

  it("falls back to title-cased field name for unknown fields", () => {
    expect(fieldLabel("some_unknown_field")).toBe("Some Unknown Field");
  });
});

describe("formatFieldValue", () => {
  it("formats null/undefined as em-dash", () => {
    expect(formatFieldValue("any", null)).toBe("—");
    expect(formatFieldValue("any", undefined)).toBe("—");
  });

  it("formats booleans with context", () => {
    expect(formatFieldValue("total_loss_recommended", true)).toBe("Yes — Total Loss");
    expect(formatFieldValue("total_loss_recommended", false)).toBe("No");
    expect(formatFieldValue("deadlines_met", true)).toBe("On Track");
    expect(formatFieldValue("deadlines_met", false)).toBe("Overdue");
    expect(formatFieldValue("proof_of_loss_needed", true)).toBe("Required");
  });

  it("formats currency values", () => {
    expect(formatFieldValue("deductible", 500)).toBe("$500");
    expect(formatFieldValue("repair_estimate_low", 1234.56)).toBe("$1,234.56");
    expect(formatFieldValue("approve_amount_cap", 15000)).toBe("$15,000");
  });

  it("formats confidence as percentage", () => {
    expect(formatFieldValue("confidence", 0.85)).toBe("85%");
    expect(formatFieldValue("confidence", 0.923)).toBe("92%");
  });

  it("formats risk_score as /100", () => {
    expect(formatFieldValue("risk_score", 25)).toBe("25/100");
  });

  it("formats enum values with human labels", () => {
    expect(formatFieldValue("coverage_status", "covered")).toBe("Covered");
    expect(formatFieldValue("coverage_status", "need_more_info")).toBe("More Information Needed");
    expect(formatFieldValue("final_outcome", "approve")).toBe("Approved");
    expect(formatFieldValue("final_outcome", "deny")).toBe("Denied");
    expect(formatFieldValue("recommendation", "siu_referral")).toBe("SIU Referral");
    expect(formatFieldValue("triage_category", "fast_track")).toBe("Fast Track");
    expect(formatFieldValue("payment_status", "disbursed")).toBe("Disbursed");
    expect(formatFieldValue("valuation_method", "local_comps")).toBe("Local Comparisons");
  });

  it("formats arrays", () => {
    expect(formatFieldValue("flags", ["staged_photos", "inconsistent_timeline"])).toBe("staged_photos, inconsistent_timeline");
    expect(formatFieldValue("flags", [])).toBe("None");
  });

  it("formats duration_ms", () => {
    expect(formatFieldValue("duration_ms", 500)).toBe("500ms");
    expect(formatFieldValue("duration_ms", 2500)).toBe("2.5s");
  });
});

describe("formatCurrency", () => {
  it("formats USD amounts", () => {
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCurrency(1500)).toBe("$1,500");
    expect(formatCurrency(12345.67)).toBe("$12,345.67");
  });
});

describe("formatCurrencyRange", () => {
  it("formats a low-high range", () => {
    expect(formatCurrencyRange(1500, 3000)).toBe("$1,500 – $3,000");
  });
});
