import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { encrypt } from "../crypto/encrypt.js";
import { computeDeadlines } from "../compliance/clock.js";
import { computeEventHash, createEventSK } from "../lib/audit.js";
import * as db from "../storage/index.js";
import * as s3 from "../storage/s3.js";
import { runPipeline } from "../openclaw/orchestrator.js";
import { notifyClaimSubmitted, notifyPipelineComplete } from "../notifications/telegram.js";

export async function claimsRoutes(app: FastifyInstance) {
  app.post("/edge/claims", async (req, reply) => {
    const body = req.body as any;

    const claimId = `CLM-${nanoid(12)}`;
    const now = new Date();

    const deadlines = computeDeadlines(now);

    const claim = {
      claim_id: claimId,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      policy_id: body.policy_id ?? "POL-UNKNOWN",
      claimant: {
        full_name: encrypt(body.claimant?.full_name ?? ""),
        phone: encrypt(body.claimant?.phone ?? ""),
        email: body.claimant?.email ? encrypt(body.claimant.email) : undefined,
        address: body.claimant?.address ? encrypt(body.claimant.address) : undefined,
      },
      loss: {
        date_of_loss: body.loss?.date_of_loss ?? now.toISOString().split("T")[0],
        state: "OH" as const,
        city: body.loss?.city,
        description: body.loss?.description ?? "",
      },
      vehicle: {
        vin: body.vehicle?.vin ? encrypt(body.vehicle.vin) : undefined,
        year: body.vehicle?.year,
        make: body.vehicle?.make,
        model: body.vehicle?.model,
      },
      stage: "FNOL_SUBMITTED",
      compliance: {
        ack_due_at: deadlines.ack_due_at,
      },
    };

    await db.putClaim(claim);

    const eventSk = createEventSK("FNOL");
    const event = {
      claim_id: claimId,
      event_sk: eventSk,
      created_at: now.toISOString(),
      stage: "FNOL_SUBMITTED",
      type: "CLAIM_CREATED",
      data: { policy_id: claim.policy_id, loss_date: claim.loss.date_of_loss },
      prev_hash: undefined,
      hash: "",
    };
    event.hash = computeEventHash(event);
    await db.putEvent(event);

    const vehicle = [body.vehicle?.year, body.vehicle?.make, body.vehicle?.model].filter(Boolean).join(" ");
    notifyClaimSubmitted(claimId, {
      policyId: body.policy_id,
      claimant: body.claimant?.full_name,
      lossDate: body.loss?.date_of_loss,
      city: body.loss?.city,
      description: body.loss?.description,
      vehicle: vehicle || undefined,
    }).catch(() => {});

    return reply.code(201).send({ claim_id: claimId, stage: "FNOL_SUBMITTED", compliance: claim.compliance });
  });

  app.get("/edge/claims/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const claim = await db.getClaim(id);
    if (!claim) return reply.code(404).send({ error: "Claim not found" });
    const events = await db.getEvents(id);
    return { claim, events };
  });

  app.post("/edge/claims/:id/attachments/presign", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { filename, content_type } = req.body as { filename: string; content_type?: string };
    const url = await s3.createPresignedUploadUrl(id, filename, content_type);
    return { upload_url: url, key: `claims/${id}/attachments/${filename}` };
  });

  app.get("/edge/claims/:id/attachments", async (req) => {
    const { id } = req.params as { id: string };
    const keys = await s3.listAttachments(id);
    return { attachments: keys };
  });

  // Internal tool routes (called by OpenClaw plugin)
  app.get("/internal/tools/claims/summary/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const claim = await db.getClaim(id);
    if (!claim) return reply.code(404).send({ error: "Claim not found" });
    return claim;
  });

  app.post("/internal/tools/claims/stage_result", async (req) => {
    const { claim_id, stage, result } = req.body as { claim_id: string; stage: string; result: any };

    const lastEvent = await db.getLastEvent(claim_id);
    const prevHash = lastEvent?.hash;

    const eventSk = createEventSK(stage);
    const event = {
      claim_id,
      event_sk: eventSk,
      created_at: new Date().toISOString(),
      stage,
      type: "STAGE_RESULT",
      data: result,
      prev_hash: prevHash,
      hash: "",
    };
    event.hash = computeEventHash(event);
    await db.putEvent(event);
    await db.updateClaimStage(claim_id, stage);

    return { ok: true, event_sk: eventSk, hash: event.hash };
  });

  app.post("/edge/claims/:id/run", async (req, reply) => {
    const { id } = req.params as { id: string };
    const claim = await db.getClaim(id);
    if (!claim) return reply.code(404).send({ error: "Claim not found" });

    try {
      const startTime = Date.now();
      const result = await runPipeline(id);
      const duration = Math.round((Date.now() - startTime) / 1000);

      notifyPipelineComplete(id, {
        finalStage: result.final_stage ?? "unknown",
        stagesCompleted: result.stages_completed ?? [],
        errors: result.errors,
        duration,
      }).catch(() => {});

      return result;
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
