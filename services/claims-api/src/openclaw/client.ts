/**
 * OpenClaw-compatible client that calls OpenRouter directly for speed/reliability.
 * Falls back to OpenClaw gateway if OPENCLAW_GATEWAY_URL is set.
 *
 * When the gateway is available, it routes through OpenClaw for sandboxing/auditing.
 * For local dev/testing, direct OpenRouter calls avoid gateway latency.
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = process.env.OPENCLAW_MODEL ?? "google/gemini-2.0-flash-001";

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL;
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";

export type AgentResponse = {
  text: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

async function callOpenRouterDirect(
  systemPrompt: string,
  userMessage: string,
  model?: string
): Promise<AgentResponse> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "x-title": "ohio-claims",
      "http-referer": "https://ohio-claims.pages.dev",
    },
    body: JSON.stringify({
      model: model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as any;
  const text = data.choices?.[0]?.message?.content ?? "";

  return {
    text,
    model: data.model ?? model ?? DEFAULT_MODEL,
    usage: data.usage,
  };
}

async function callGateway(
  agentId: string,
  message: string,
  sessionId?: string
): Promise<AgentResponse> {
  if (!GATEWAY_URL) throw new Error("OPENCLAW_GATEWAY_URL not set");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-openclaw-agent-id": agentId,
  };
  if (GATEWAY_TOKEN) headers["authorization"] = `Bearer ${GATEWAY_TOKEN}`;
  if (sessionId) headers["x-openclaw-session-key"] = sessionId;

  const res = await fetch(`${GATEWAY_URL}/v1/responses`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: `openrouter/${DEFAULT_MODEL}`,
      input: message,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenClaw gateway failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as any;
  let text = "";
  for (const item of data.output ?? []) {
    if (item.type === "message" && item.content) {
      for (const c of item.content) {
        if (c.type === "output_text") text += c.text;
      }
    }
  }

  return { text, model: DEFAULT_MODEL, usage: data.usage };
}

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = resolve(__dirname, "../../../../openclaw/agents");

function loadSystemPrompt(agentId: string): string {
  try {
    return readFileSync(resolve(AGENTS_DIR, agentId, "SYSTEM_PROMPT.md"), "utf-8");
  } catch {
    return `You are the ${agentId} agent. Respond ONLY with valid JSON matching your OUTPUT_SCHEMA. No markdown, no code fences, no explanation text.`;
  }
}

export async function runAgent(
  agentId: string,
  message: string,
  sessionId?: string
): Promise<AgentResponse> {
  if (GATEWAY_URL) {
    return callGateway(agentId, message, sessionId);
  }

  const systemPrompt = loadSystemPrompt(agentId);
  return callOpenRouterDirect(systemPrompt, message);
}
