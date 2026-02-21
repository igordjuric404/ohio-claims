import type { FastifyInstance } from "fastify";
import * as db from "../storage/index.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedUploadUrlForKey, listByPrefix } from "../storage/s3.js";

const s3Client = new S3Client({});
const S3_BUCKET = process.env.S3_BUCKET ?? "ohio-claims-dev-attachments-422287833706-eu-central-1";
import { getACV } from "../tools/pricing.js";
import { ulid } from "ulid";
import { randomBytes } from "node:crypto";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const VISION_MODEL = process.env.VISION_MODEL ?? "google/gemini-2.0-flash-001";
const WEB_SEARCH_MODEL = process.env.WEB_SEARCH_MODEL ?? "google/gemini-2.0-flash-001:online";
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

type WebCitation = { url: string; title: string; content?: string };

async function webSearchPricing(
  vehicle: { year?: number; make?: string; model?: string },
  partsNeeded: any[],
  city: string
): Promise<{ text: string; citations: WebCitation[]; usage?: any }> {
  const vehicleStr = `${vehicle.year ?? "?"} ${vehicle.make ?? "?"} ${vehicle.model ?? "?"}`;
  const partsList = partsNeeded.map(p => `- ${p.name} (qty: ${p.qty}, condition: ${p.condition_recommendation})`).join("\n");

  const prompt = `I need current pricing for auto body repair parts and labor for a ${vehicleStr} in ${city}, Ohio.

Parts needed:
${partsList}

For each part, find:
1. Current price range (low and high estimate) for both OEM and aftermarket options
2. Source/retailer where you found the pricing

Also find:
3. Current body shop labor rate per hour in ${city}, Ohio
4. Sources for the labor rate data

Return a structured JSON response:
{
  "parts_pricing": [
    {
      "name": "part name",
      "oem_low": number,
      "oem_high": number,
      "aftermarket_low": number,
      "aftermarket_high": number,
      "sources": ["url1", "url2"]
    }
  ],
  "labor_rate": {
    "rate_per_hour": number,
    "sources": ["url1"]
  },
  "search_queries": ["what you searched for"]
}

Return ONLY valid JSON, no markdown fences.`;

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "x-title": "ohio-claims-assessor-pricing",
    },
    body: JSON.stringify({
      model: WEB_SEARCH_MODEL,
      messages: [
        { role: "system", content: "You are an auto repair cost researcher. Search the web for current parts pricing and labor rates. Return structured JSON with sources." },
        { role: "user", content: prompt },
      ],
      max_tokens: 3000,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Web search pricing failed (${res.status}): ${errText.substring(0, 200)}`);
  }

  const data = await res.json() as any;
  const text = data.choices?.[0]?.message?.content ?? "";
  const annotations = data.choices?.[0]?.message?.annotations ?? [];

  const sanitize = (s: string) => s.replace(/[\x00-\x1f\x7f]/g, " ").trim();

  const citations: WebCitation[] = annotations
    .filter((a: any) => a.type === "url_citation")
    .map((a: any) => ({
      url: sanitize(a.url_citation?.url ?? ""),
      title: sanitize(a.url_citation?.title ?? ""),
      content: a.url_citation?.content ? sanitize(a.url_citation.content.substring(0, 300)) : undefined,
    }));

  return { text, citations, usage: data.usage };
}

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

    let seqCounter = 1;
    const emitRunEvent = async (eventType: string, payload: unknown) => {
      await db.putRunEvent({
        run_id: runId,
        seq: seqCounter++,
        ts: new Date().toISOString(),
        event_type: eventType,
        payload,
      });
    };

    const vehicle = (claim as any).vehicle ?? {};
    const city = (claim as any).loss?.city ?? "Columbus";

    await db.putRun({
      run_id: runId,
      claim_id: id,
      stage: "DAMAGE_ASSESSMENT",
      agent_id: "assessor_vision",
      status: "RUNNING",
      started_at: started.toISOString(),
      actor_id: "system",
      trace_id: traceId,
      input_prompt: `Vision assessment for claim ${id}, vehicle: ${vehicle.year ?? "?"} ${vehicle.make ?? "?"} ${vehicle.model ?? "?"}`,
    });

    try {
      const photoKeys = await listByPrefix(`claims/${id}/damage_photos/`);

      if (photoKeys.length === 0) {
        throw new Error("No damage photos found. Upload photos first.");
      }

      await emitRunEvent("stage.started", { agent_id: "assessor_vision", claim_id: id, stage: "DAMAGE_ASSESSMENT" });
      await emitRunEvent("agent.input", {
        system_prompt: ASSESSOR_VISION_PROMPT.substring(0, 2000),
        prompt: `Analyze ${photoKeys.length} damage photos for claim ${id}`,
        images_count: photoKeys.length,
        image_keys: photoKeys,
      });

      // Step 1: Vision analysis
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
            { type: "text", text: `Analyze ${imageContentParts.length} damage photos for claim ${id}. Vehicle: ${vehicle.year ?? "?"} ${vehicle.make ?? "?"} ${vehicle.model ?? "?"}` },
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

      await emitRunEvent("agent.response", { model: VISION_MODEL, usage: visionData.usage, step: "vision_analysis" });
      await emitRunEvent("agent.raw_output", { raw_text: visionText.substring(0, 5000), step: "vision_analysis" });

      if (visionText.startsWith("```")) {
        visionText = visionText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const visionOutput = JSON.parse(visionText);

      // Step 2: Web search for pricing
      let webSearchResult: { text: string; citations: WebCitation[]; usage?: any } | null = null;
      let webPricingData: any = null;

      try {
        webSearchResult = await webSearchPricing(vehicle, visionOutput.parts_needed ?? [], city);

        await emitRunEvent("web_search.completed", {
          model: WEB_SEARCH_MODEL,
          citations: webSearchResult.citations,
          usage: webSearchResult.usage,
          raw_text: webSearchResult.text.substring(0, 3000).replace(/[\x00-\x1f\x7f]/g, " "),
        });

        let pricingText = webSearchResult.text;
        if (pricingText.startsWith("```")) {
          pricingText = pricingText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        }
        webPricingData = JSON.parse(pricingText);
      } catch (err: any) {
        console.warn(`Web search pricing failed, falling back to simulated: ${err.message}`);
        await emitRunEvent("web_search.failed", { error: err.message });
      }

      // Compute pricing from web search or fallback to simulated
      const partsResults = [];
      let partsLow = 0, partsHigh = 0;

      if (webPricingData?.parts_pricing) {
        for (const wp of webPricingData.parts_pricing) {
          const low = wp.aftermarket_low ?? wp.oem_low ?? 100;
          const high = wp.oem_high ?? wp.aftermarket_high ?? 400;
          partsResults.push({
            name: wp.name,
            qty: 1,
            condition_recommendation: "aftermarket",
            pricing: { price_low: low, price_high: high, source: "web_search", web_sources: wp.sources },
          });
          partsLow += low;
          partsHigh += high;
        }
      } else {
        // Fallback to simulated
        const { searchParts, getLocalLaborRate: _glr } = await import("../tools/pricing.js");
        for (const part of visionOutput.parts_needed ?? []) {
          const results = await searchParts({ vehicle, part_name: part.name, condition: part.condition_recommendation });
          partsResults.push({ ...part, pricing: results[0] });
          partsLow += (results[0]?.price_low ?? 0) * (part.qty ?? 1);
          partsHigh += (results[0]?.price_high ?? 0) * (part.qty ?? 1);
        }
      }

      const laborRateValue = webPricingData?.labor_rate?.rate_per_hour ?? 65;
      const laborRateSources = webPricingData?.labor_rate?.sources ?? ["simulated"];
      const laborRate = { rate_per_hour: laborRateValue, locality: `${city}, OH`, sources: laborRateSources };

      let laborHours = 0;
      for (const op of visionOutput.labor_operations ?? []) {
        laborHours += op.estimated_hours ?? 0;
      }
      const laborTotal = Math.round(laborHours * laborRateValue);

      const estimateLow = partsLow + laborTotal;
      const estimateHigh = partsHigh + laborTotal;

      const acvResult = await getACV({ vehicle });
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
          basis: `${laborRateValue}/hr`,
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
        web_search_model: WEB_SEARCH_MODEL,
        usage: visionData.usage,
        web_search: {
          queries: webPricingData?.search_queries ?? [],
          citations: webSearchResult?.citations ?? [],
          pricing_source: webPricingData ? "web_search" : "simulated",
        },
      };

      await emitRunEvent("stage.completed", report);

      const ended = new Date();
      await db.updateRunStatus(runId, "SUCCEEDED", {
        ended_at: ended.toISOString(),
        duration_ms: ended.getTime() - started.getTime(),
        model: VISION_MODEL,
        usage: visionData.usage,
        output_json: report,
      });

      return report;
    } catch (err: any) {
      await emitRunEvent("stage.failed", { error: err.message });
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
