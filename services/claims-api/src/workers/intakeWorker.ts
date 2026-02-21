import { ulid } from "ulid";
import * as db from "../storage/index.js";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL ?? "google/gemini-2.0-flash-001";

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET ?? "ohio-claims-dev-attachments-422287833706-eu-central-1";

const EXTRACTION_PROMPT = `You are a claims intake document extraction system for Ohio auto insurance claims.
Extract structured claim data from the provided document text. Return ONLY valid JSON with these fields:

{
  "policy_id": "string or null",
  "claimant": {
    "full_name": "string",
    "phone": "string or null",
    "email": "string or null",
    "address": "string or null"
  },
  "loss": {
    "date_of_loss": "YYYY-MM-DD",
    "city": "string or null",
    "description": "string"
  },
  "vehicle": {
    "vin": "string or null",
    "year": "number or null",
    "make": "string or null",
    "model": "string or null"
  },
  "field_confidence": {
    "<field_path>": 0.0-1.0
  },
  "provenance": {
    "<field_path>": { "method": "llm_extraction", "excerpt": "relevant text excerpt" }
  }
}

Be conservative with confidence scores. If a field is unclear, set confidence below 0.5.
If a field cannot be found, set it to null with confidence 0.`;

async function fetchFileText(key: string, contentType: string): Promise<string> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const buf = await res.Body?.transformToByteArray();
    if (!buf) return "";

    if (contentType.includes("pdf")) {
      try {
        const pdfMod = await import("pdf-parse");
        const pdfParse = (pdfMod as any).default ?? pdfMod;
        const result = await pdfParse(Buffer.from(buf));
        return result.text || "";
      } catch {
        return "[PDF could not be parsed]";
      }
    }

    if (contentType.startsWith("text/") || contentType.includes("json")) {
      return new TextDecoder().decode(buf);
    }

    if (contentType.startsWith("image/")) {
      return `[Image file: ${key}]`;
    }

    return `[Binary file: ${key}]`;
  } catch (err: any) {
    return `[Error reading file: ${err.message}]`;
  }
}

async function callLLMExtraction(documentText: string): Promise<{
  extracted_fields: Record<string, unknown>;
  field_confidence: Record<string, number>;
  provenance: Record<string, unknown>;
}> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "x-title": "ohio-claims-intake",
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Extract claim data from this document:\n\n${documentText.substring(0, 8000)}` },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM extraction failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  let text = data.choices?.[0]?.message?.content ?? "";

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(text);

  const { field_confidence, provenance, ...fields } = parsed;
  return {
    extracted_fields: fields,
    field_confidence: field_confidence ?? {},
    provenance: provenance ?? {},
  };
}

export async function processIntakeJob(jobId: string): Promise<void> {
  const job = await db.getIntakeJob(jobId);
  if (!job) throw new Error(`IntakeJob ${jobId} not found`);

  const runId = ulid();
  await db.updateIntakeJob(jobId, { status: "RUNNING", run_id: runId, updated_at: new Date().toISOString() });

  try {
    const files = (job.files as any[]) ?? [];
    const allText: string[] = [];

    for (const file of files) {
      const text = await fetchFileText(file.key, file.content_type ?? "application/octet-stream");
      allText.push(`--- File: ${file.filename} (${file.content_type}) ---\n${text}`);
    }

    const combinedText = allText.join("\n\n");

    if (combinedText.length < 20) {
      await db.updateIntakeJob(jobId, {
        status: "FAILED",
        error: "No extractable text found in uploaded files",
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const { extracted_fields, field_confidence, provenance } = await callLLMExtraction(combinedText);

    await db.updateIntakeJob(jobId, {
      status: "SUCCEEDED",
      extracted_fields,
      field_confidence,
      provenance,
      run_id: runId,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    await db.updateIntakeJob(jobId, {
      status: "FAILED",
      error: err.message,
      updated_at: new Date().toISOString(),
    });
  }
}
