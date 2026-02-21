import type { FastifyInstance } from "fastify";
import { requireReviewer } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";
import { listByPrefix, createPresignedGetUrl } from "../../storage/s3.js";
import { computeEventHash, createEventSK } from "../../lib/audit.js";
import { runFinanceStage } from "../../openclaw/orchestrator.js";
import { decrypt } from "../../crypto/encrypt.js";

function tryDecrypt(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

function decryptClaimForDisplay(claim: Record<string, unknown>): Record<string, unknown> {
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

export async function reviewerClaimsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireReviewer);

  app.get("/reviewer/claims", async (req) => {
    const q = req.query as Record<string, string>;
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const cursor = q.cursor ? JSON.parse(Buffer.from(q.cursor, "base64url").toString()) : undefined;
    const { items, lastKey } = await db.scanClaims(limit, cursor);

    let filtered = items;
    if (q.stage) {
      filtered = filtered.filter((c) => c.stage === q.stage);
    }
    // When no stage filter: show all claims (no stage-based filtering)
    if (q.search) {
      const s = q.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          (c.claim_id as string).toLowerCase().includes(s) ||
          (c.policy_id as string).toLowerCase().includes(s)
      );
    }

    return {
      claims: filtered.map((c) => decryptClaimForDisplay(c as Record<string, unknown>)),
      cursor: lastKey ? Buffer.from(JSON.stringify(lastKey)).toString("base64url") : null,
    };
  });

  app.get("/reviewer/claims/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const claim = await db.getClaim(id);
    if (!claim) return reply.code(404).send({ error: "Claim not found" });

    const events = await db.getEvents(id);
    const runs = await db.getRunsForClaim(id);

    const agentOutputs: Record<string, { input?: string; output?: unknown; reasoning?: string }> = {};
    const judgeReports: Record<string, unknown> = {};

    for (const run of runs) {
      const agentId = run.agent_id as string;
      agentOutputs[agentId] = {
        input: run.input_prompt as string | undefined,
        output: (run as any).output_json ?? null,
        reasoning: (run as any).reasoning ?? null,
      };

      const runEvts = await db.getRunEvents(run.run_id as string);
      const judgeRounds = runEvts
        .filter((e) => e.event_type === "judge.round")
        .sort((a, b) => ((a as any).payload?.round ?? 0) - ((b as any).payload?.round ?? 0));
      if (judgeRounds.length > 0) {
        const lastPayload = (judgeRounds[judgeRounds.length - 1] as any).payload;
        judgeReports[agentId] = {
          ...lastPayload,
          total_rounds: judgeRounds.length,
          rounds: judgeRounds.map((e) => (e as any).payload),
        };
      }
    }

    return {
      claim: decryptClaimForDisplay(claim as Record<string, unknown>),
      events,
      runs,
      agent_outputs: agentOutputs,
      judge_reports: judgeReports,
    };
  });

  app.get("/reviewer/claims/:id/photos", async (req) => {
    const { id } = req.params as { id: string };
    try {
      const keys = await listByPrefix(`claims/${id}/damage_photos/`);
      const photos = await Promise.all(
        keys.map(async (key) => ({
          key,
          filename: key.split("/").pop() ?? key,
          url: await createPresignedGetUrl(key, 3600),
        }))
      );
      return { photos };
    } catch {
      return { photos: [] };
    }
  });

  app.post("/reviewer/claims/:id/decision", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      decision: "approve" | "deny";
      rationale: string;
      approve_amount_cap?: number;
    };

    if (!body.decision || !["approve", "deny"].includes(body.decision)) {
      return reply.code(400).send({ error: "Decision must be 'approve' or 'deny'" });
    }
    if (!body.rationale?.trim()) {
      return reply.code(400).send({ error: "Rationale is required" });
    }

    const claim = await db.getClaim(id);
    if (!claim) return reply.code(404).send({ error: "Claim not found" });
    if (claim.stage !== "PENDING_REVIEW") {
      return reply.code(409).send({ error: `Claim is in stage ${claim.stage}, not PENDING_REVIEW` });
    }

    const session = (req as any).reviewerSession;
    const actorId = session?.actor_id ?? "reviewer";

    const decisionData = {
      final_outcome: body.decision === "approve" ? "approve" : "deny",
      rationale: body.rationale,
      approve_amount_cap: body.approve_amount_cap ?? null,
      decided_by: actorId,
      decided_at: new Date().toISOString(),
    };

    const lastEvent = await db.getLastEvent(id);
    const prevHash = lastEvent?.hash as string | undefined;
    const eventSk = createEventSK("FINAL_DECISION");
    const event: Record<string, unknown> = {
      claim_id: id,
      event_sk: eventSk,
      created_at: new Date().toISOString(),
      stage: "FINAL_DECISION_DONE",
      type: "REVIEWER_DECISION",
      data: decisionData,
      prev_hash: prevHash,
      hash: "",
      actor_id: actorId,
    };
    event.hash = computeEventHash(event);
    await db.putEvent(event);
    await db.updateClaimStage(id, "FINAL_DECISION_DONE");

    let financeResult = null;

    if (body.decision === "approve") {
      financeResult = await runFinanceStage(id, decisionData, actorId);
      if (!financeResult.ok) {
        return {
          ok: true,
          decision: decisionData,
          finance: { ok: false, error: financeResult.error },
          final_stage: "FINAL_DECISION_DONE",
        };
      }
    } else {
      const noPayEvent: Record<string, unknown> = {
        claim_id: id,
        event_sk: createEventSK("CLOSED_NO_PAY"),
        created_at: new Date().toISOString(),
        stage: "CLOSED_NO_PAY",
        type: "STAGE_COMPLETED",
        data: { reason: "denied", rationale: body.rationale },
        prev_hash: event.hash,
        hash: "",
        actor_id: actorId,
      };
      noPayEvent.hash = computeEventHash(noPayEvent);
      await db.putEvent(noPayEvent);
      await db.updateClaimStage(id, "CLOSED_NO_PAY");
    }

    const updatedClaim = await db.getClaim(id);
    return {
      ok: true,
      decision: decisionData,
      finance: financeResult ? { ok: financeResult.ok, output: financeResult.output } : null,
      final_stage: updatedClaim?.stage,
    };
  });
}
