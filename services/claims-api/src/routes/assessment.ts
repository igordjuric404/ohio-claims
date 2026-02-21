import type { FastifyInstance } from "fastify";
import * as db from "../storage/index.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedUploadUrlForKey, listByPrefix } from "../storage/s3.js";

const s3Client = new S3Client({});
const S3_BUCKET = process.env.S3_BUCKET ?? "ohio-claims-dev-attachments";
import { searchParts, getLocalLaborRate, getACV } from "../tools/pricing.js";
import { ulid } from "ulid";
import { randomBytes } from "node:crypto";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const VISION_MODEL = process.env.VISION_MODEL ?? "google/gemini-2.0-flash-001";
const SALVAGE_PCT = Number(process.env.SALVAGE_PCT ?? "0.20");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ASSESSOR_VISION_PROMPT = `You are an expert auto damage assessor analyzing vehicle damage photos for an Ohio insurance claim.

Analyze the damage visible in the photos and produce a structured JSON report:
{
  "detected_damage": [
    {
      "part": "string (e.g., rear bumper, trunk lid, tail light)",
      "severity": "minor|moderate|severe",
      "side": "front|rear|left|right|top|bottom",
      "description": "brief description of visible damage"
    }
  ],
  "parts_needed": [
    { "name": "string", "qty": 1, "condition_recommendation": "new_oem|aftermarket|lkq" }
  ],
  "labor_operations": [
    { "operation": "string (e.g., R&R rear bumper, blend paint)", "estimated_hours": 1.5 }
  ],
  "total_loss_indicators": "string or null (any signs suggesting total loss)",
  "confidence": 0.0-1.0
}

Be thorough but conservative. Only report damage clearly visible in the images.
Return ONLY valid JSON, no markdown fences.`;

export async function assessmentRoutes(app: FastifyInstance) {
  app.post("/edge/claims/:id/damage-photos/presign", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { filename, content_type } = (req.body ?? {}) as { filename: string; content_type?: string };

    if (!filename) return reply.code(400).send({ error: "filename required" });
    const ct = content_type ?? "image/jpeg";
    if (!ALLOWED_IMAGE_TYPES.includes(ct)) {
      return reply.code(400).send({ error: `Content type ${ct} not allowed. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}` });
    }

    const key = `claims/${id}/damage_photos/${filename}`;
    const url = await createPresignedUploadUrlForKey(key, ct);
    return { upload_url: url, key, attachment_type: "damage_photo" };
  });

  app.get("/edge/claims/:id/damage-photos", async (req) => {
    const { id } = req.params as { id: string };
    const damagePhotos = await listByPrefix(`claims/${id}/damage_photos/`);
    return { photos: damagePhotos };
  });

  app.post("/edge/claims/:id/assess", async (req, reply) => {
    const { id } = req.params as { id: string };
    const claim = await db.getClaim(id);
    if (!claim) return reply.code(404).send({ error: "Claim not found" });

    const runId = ulid();
    const traceId = randomBytes(16).toString("hex");
    const started = new Date();

    await db.putRun({
      run_id: runId,
      claim_id: id,
      stage: "DAMAGE_ASSESSMENT",
      agent_id: "assessor_vision",
      status: "RUNNING",
      started_at: started.toISOString(),
      actor_id: "system",
      trace_id: traceId,
    });

    try {
      const photoKeys = await listByPrefix(`claims/${id}/damage_photos/`);

      if (photoKeys.length === 0) {
        throw new Error("No damage photos found. Upload photos first.");
      }

      // Read images from S3 and encode as base64 data URLs
      const imageContentParts: any[] = [];
      for (const key of photoKeys.slice(0, 8)) {
        try {
          const res = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
          const buf = await res.Body?.transformToByteArray();
          if (buf) {
            const b64 = Buffer.from(buf).toString("base64");
            const ext = key.split(".").pop()?.toLowerCase() ?? "jpeg";
            const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
            imageContentParts.push({
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${b64}` },
            });
          }
        } catch (err: any) {
          console.warn(`Failed to read photo ${key}: ${err.message}`);
        }
      }

      if (imageContentParts.length === 0) {
        throw new Error("Could not read any damage photos from storage.");
      }

      const visionMessages: any[] = [
        { role: "system", content: ASSESSOR_VISION_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze ${imageContentParts.length} damage photos for claim ${id}. Vehicle: ${(claim as any).vehicle?.year ?? "?"} ${(claim as any).vehicle?.make ?? "?"} ${(claim as any).vehicle?.model ?? "?"}` },
            ...imageContentParts,
          ],
        },
      ];

      const visionRes = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "content-type": "application/json",
          "x-title": "ohio-claims-assessor",
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: visionMessages,
          max_tokens: 3000,
          temperature: 0.1,
        }),
      });

      if (!visionRes.ok) {
        const errText = await visionRes.text();
        throw new Error(`Vision model failed (${visionRes.status}): ${errText.substring(0, 200)}`);
      }

      const visionData = (await visionRes.json()) as any;
      let visionText = visionData.choices?.[0]?.message?.content ?? "";
      if (visionText.startsWith("```")) {
        visionText = visionText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const visionOutput = JSON.parse(visionText);

      // Use tools to get pricing data
      const vehicle = (claim as any).vehicle ?? {};
      const city = (claim as any).loss?.city ?? "Columbus";

      const partsResults = [];
      for (const part of visionOutput.parts_needed ?? []) {
        const results = await searchParts({
          vehicle,
          part_name: part.name,
          condition: part.condition_recommendation,
        });
        partsResults.push({
          ...part,
          pricing: results[0],
        });
      }

      const laborRate = await getLocalLaborRate({ city, state: "OH" });
      const acvResult = await getACV({ vehicle });

      // Compute totals
      let partsLow = 0, partsHigh = 0;
      for (const p of partsResults) {
        partsLow += (p.pricing?.price_low ?? 0) * (p.qty ?? 1);
        partsHigh += (p.pricing?.price_high ?? 0) * (p.qty ?? 1);
      }

      let laborHours = 0;
      for (const op of visionOutput.labor_operations ?? []) {
        laborHours += op.estimated_hours ?? 0;
      }
      const laborTotal = Math.round(laborHours * laborRate.rate_per_hour);

      const estimateLow = partsLow + laborTotal;
      const estimateHigh = partsHigh + laborTotal;

      // Total loss calculation
      const acv = acvResult.actual_cash_value;
      const salvageValue = Math.round(acv * SALVAGE_PCT);
      const totalLoss = estimateHigh + salvageValue >= acv;

      const report = {
        claim_id: id,
        run_id: runId,
        photos_analyzed: photoKeys.length,
        detected_damage: visionOutput.detected_damage ?? [],
        parts: partsResults,
        labor: (visionOutput.labor_operations ?? []).map((op: any) => ({
          ...op,
          basis: `${laborRate.rate_per_hour}/hr`,
        })),
        labor_rate: laborRate,
        totals: {
          parts_total_range: { low: partsLow, high: partsHigh },
          labor_total: laborTotal,
          estimate_range: { low: estimateLow, high: estimateHigh },
        },
        total_loss: {
          recommended: totalLoss,
          basis: `repair_high(${estimateHigh}) + salvage(${salvageValue}) ${totalLoss ? ">=" : "<"} acv(${acv})`,
          thresholds: { acv, salvage_pct: SALVAGE_PCT, salvage_value: salvageValue },
        },
        acv: acvResult,
        vision_confidence: visionOutput.confidence ?? 0.5,
        model: VISION_MODEL,
        usage: visionData.usage,
      };

      const ended = new Date();
      await db.updateRunStatus(runId, "SUCCEEDED", {
        ended_at: ended.toISOString(),
        duration_ms: ended.getTime() - started.getTime(),
        model: VISION_MODEL,
        usage: visionData.usage,
      });

      return report;
    } catch (err: any) {
      const ended = new Date();
      await db.updateRunStatus(runId, "FAILED", {
        ended_at: ended.toISOString(),
        duration_ms: ended.getTime() - started.getTime(),
        error: err.message,
      });
      return reply.code(500).send({ error: err.message, run_id: runId });
    }
  });
}
