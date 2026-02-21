import { describe, it, expect } from "vitest";
import { computeEventHash, createEventSK } from "../src/lib/audit.js";

describe("Audit event hash chain", () => {
  it("produces deterministic hash for same input", () => {
    const event = {
      claim_id: "CLM-test",
      event_sk: "2026-02-21T10:00:00.000Z#FNOL#abc12345",
      created_at: "2026-02-21T10:00:00.000Z",
      stage: "FNOL_SUBMITTED",
      type: "CLAIM_CREATED",
      data: { policy_id: "POL-001" },
      prev_hash: undefined,
    };
    const h1 = computeEventHash(event);
    const h2 = computeEventHash(event);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("changes hash when data changes", () => {
    const base = {
      claim_id: "CLM-test",
      event_sk: "2026-02-21T10:00:00.000Z#FNOL#abc12345",
      created_at: "2026-02-21T10:00:00.000Z",
      stage: "FNOL_SUBMITTED",
      type: "CLAIM_CREATED",
      data: { policy_id: "POL-001" },
      prev_hash: undefined,
    };
    const h1 = computeEventHash(base);
    const h2 = computeEventHash({ ...base, data: { policy_id: "POL-002" } });
    expect(h1).not.toBe(h2);
  });

  it("includes prev_hash in chain", () => {
    const e1 = {
      claim_id: "CLM-test",
      event_sk: "sk1",
      created_at: "2026-02-21T10:00:00.000Z",
      stage: "FNOL_SUBMITTED",
      type: "CLAIM_CREATED",
      data: {},
      prev_hash: undefined,
    };
    const h1 = computeEventHash(e1);

    const e2 = { ...e1, event_sk: "sk2", prev_hash: h1 };
    const h2 = computeEventHash(e2);

    const e2NoPrev = { ...e1, event_sk: "sk2", prev_hash: undefined };
    const h2NoPrev = computeEventHash(e2NoPrev);

    expect(h2).not.toBe(h2NoPrev);
  });
});

describe("createEventSK", () => {
  it("includes stage name", () => {
    const sk = createEventSK("FRONTDESK");
    expect(sk).toContain("FRONTDESK");
  });

  it("starts with ISO timestamp", () => {
    const sk = createEventSK("TEST");
    expect(sk).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
