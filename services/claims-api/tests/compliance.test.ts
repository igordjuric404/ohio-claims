import { describe, it, expect } from "vitest";
import { computeDeadlines, computePaymentDeadline, isDeadlineMet } from "../src/compliance/clock.js";

describe("Ohio compliance clock", () => {
  const claimDate = new Date("2026-02-21T10:00:00Z");

  it("computes 15-day ack deadline", () => {
    const d = computeDeadlines(claimDate);
    expect(d.ack_due_at).toBe(new Date("2026-03-08T10:00:00Z").toISOString());
  });

  it("computes 21-day accept/deny deadline after proof of loss", () => {
    const pol = new Date("2026-02-25T00:00:00Z");
    const d = computeDeadlines(claimDate, pol);
    expect(d.accept_deny_due_at).toBe(new Date("2026-03-18T00:00:00Z").toISOString());
  });

  it("computes 45-day status update deadline after proof of loss", () => {
    const pol = new Date("2026-02-25T00:00:00Z");
    const d = computeDeadlines(claimDate, pol);
    expect(d.next_status_update_due_at).toBe(new Date("2026-04-11T00:00:00Z").toISOString());
  });

  it("computes 60-day fraud report deadline after proof of loss", () => {
    const pol = new Date("2026-02-25T00:00:00Z");
    const d = computeDeadlines(claimDate, pol);
    expect(d.fraud_report_due_at).toBe(new Date("2026-04-26T00:00:00Z").toISOString());
  });

  it("returns undefined optional deadlines without proof of loss", () => {
    const d = computeDeadlines(claimDate);
    expect(d.accept_deny_due_at).toBeUndefined();
    expect(d.next_status_update_due_at).toBeUndefined();
  });
});

describe("Payment deadline (10 business days)", () => {
  it("skips weekends", () => {
    // Friday Feb 20, 2026 + 10 biz days = Fri March 6, 2026
    const accepted = new Date("2026-02-20T00:00:00Z");
    const due = computePaymentDeadline(accepted);
    const dueDate = new Date(due);
    expect(dueDate.getDay()).not.toBe(0); // not Sunday
    expect(dueDate.getDay()).not.toBe(6); // not Saturday
  });
});

describe("isDeadlineMet", () => {
  it("returns true when before deadline", () => {
    expect(isDeadlineMet("2026-12-31T00:00:00Z", new Date("2026-06-01T00:00:00Z"))).toBe(true);
  });

  it("returns false when past deadline", () => {
    expect(isDeadlineMet("2026-01-01T00:00:00Z", new Date("2026-06-01T00:00:00Z"))).toBe(false);
  });
});
