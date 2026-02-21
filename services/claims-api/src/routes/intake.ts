import type { FastifyInstance } from "fastify";
import { ulid } from "ulid";
import { nanoid } from "nanoid";
import * as db from "../storage/index.js";
import { createPresignedUploadUrlForKey } from "../storage/s3.js";
import { encrypt } from "../crypto/encrypt.js";
import { computeDeadlines } from "../compliance/clock.js";
import { computeEventHash, createEventSK } from "../lib/audit.js";
import { processIntakeJob } from "../workers/intakeWorker.js";

export async function intakeRoutes(app: FastifyInstance) {
  app.post("/edge/intake/jobs", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const jobId = ulid();
    const now = new Date().toISOString();

    const job = {
      intake_job_id: jobId,
      status: "QUEUED",
      created_at: now,
      updated_at: now,
      actor_id: (body.actor_id as string) ?? "user",
      files: [],
    };

    await db.putIntakeJob(job);
    return reply.code(201).send({ intake_job_id: jobId, status: "QUEUED" });
  });

  app.post("/edge/intake/jobs/:id/files/presign", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await db.getIntakeJob(id);
    if (!job) return reply.code(404).send({ error: "Intake job not found" });

    const { filename, content_type } = (req.body ?? {}) as { filename: string; content_type?: string };
    if (!filename) return reply.code(400).send({ error: "filename required" });

    const s3Key = `intake/${id}/${filename}`;
    const url = await createPresignedUploadUrlForKey(s3Key, content_type ?? "application/octet-stream");

    const files = (job.files as any[]) ?? [];
    files.push({
      key: s3Key,
      filename,
      content_type: content_type ?? "application/octet-stream",
    });

    await db.updateIntakeJob(id, { files, updated_at: new Date().toISOString() });

    return { upload_url: url, key: s3Key };
  });

  app.post("/edge/intake/jobs/:id/extract", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await db.getIntakeJob(id);
    if (!job) return reply.code(404).send({ error: "Intake job not found" });

    // Fire-and-forget extraction, client polls for status
    processIntakeJob(id).catch((err) => {
      console.error(`Intake extraction failed for ${id}:`, err);
    });

    return { status: "RUNNING", message: "Extraction started. Poll GET /edge/intake/jobs/:id for results." };
  });

  app.get("/edge/intake/jobs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await db.getIntakeJob(id);
    if (!job) return reply.code(404).send({ error: "Intake job not found" });
    return job;
  });

  app.post("/edge/intake/jobs/:id/confirm", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await db.getIntakeJob(id);
    if (!job) return reply.code(404).send({ error: "Intake job not found" });
    if (job.status !== "SUCCEEDED") return reply.code(400).send({ error: "Job not in SUCCEEDED state" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const fields = (body.fields ?? job.extracted_fields) as Record<string, unknown>;

    if (!fields) return reply.code(400).send({ error: "No extracted fields to confirm" });

    const claimId = `CLM-${nanoid(12)}`;
    const now = new Date();
    const deadlines = computeDeadlines(now);

    const claimant = (fields.claimant ?? {}) as Record<string, string>;
    const loss = (fields.loss ?? {}) as Record<string, unknown>;
    const vehicle = (fields.vehicle ?? {}) as Record<string, unknown>;

    const claim = {
      claim_id: claimId,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      policy_id: (fields.policy_id as string) ?? "POL-UNKNOWN",
      claimant: {
        full_name: encrypt(claimant.full_name ?? ""),
        phone: encrypt(claimant.phone ?? ""),
        email: claimant.email ? encrypt(claimant.email) : undefined,
        address: claimant.address ? encrypt(claimant.address) : undefined,
      },
      loss: {
        date_of_loss: (loss.date_of_loss as string) ?? now.toISOString().split("T")[0],
        state: "OH" as const,
        city: loss.city as string,
        description: (loss.description as string) ?? "",
      },
      vehicle: {
        vin: vehicle.vin ? encrypt(vehicle.vin as string) : undefined,
        year: vehicle.year as number,
        make: vehicle.make as string,
        model: vehicle.model as string,
      },
      stage: "FNOL_SUBMITTED",
      compliance: { ack_due_at: deadlines.ack_due_at },
      intake_job_id: id,
    };

    await db.putClaim(claim);

    const eventSk = createEventSK("FNOL");
    const event: Record<string, unknown> = {
      claim_id: claimId,
      event_sk: eventSk,
      created_at: now.toISOString(),
      stage: "FNOL_SUBMITTED",
      type: "CLAIM_CREATED",
      data: { policy_id: claim.policy_id, loss_date: claim.loss.date_of_loss, source: "intake", intake_job_id: id },
      prev_hash: undefined,
      hash: "",
    };
    event.hash = computeEventHash(event);
    await db.putEvent(event);

    await db.updateIntakeJob(id, { claim_id: claimId, updated_at: now.toISOString() });

    return reply.code(201).send({
      claim_id: claimId,
      stage: "FNOL_SUBMITTED",
      compliance: claim.compliance,
      source: "intake",
    });
  });
}
