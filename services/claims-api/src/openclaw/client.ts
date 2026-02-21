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

export type UrlCitation = {
  url: string;
  title?: string;
  content?: string;
  start_index?: number;
  end_index?: number;
};

export type AgentResponse = {
  text: string;
  model: string;
  reasoning?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  citations?: UrlCitation[];
};

export type WebSearchPlugin = {
  id: "web";
  max_results?: number;
  search_prompt?: string;
};

export type AgentCallOptions = {
  model?: string;
  enableReasoning?: boolean;
  plugins?: WebSearchPlugin[];
};

async function callOpenRouterDirect(
  systemPrompt: string,
  userMessage: string,
  options: AgentCallOptions = {}
): Promise<AgentResponse> {
  const model = options.model ?? DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 4000,
    temperature: 0.1,
  };

  if (options.enableReasoning) {
    body.reasoning = { max_tokens: 2000 };
  }

  if (options.plugins && options.plugins.length > 0) {
    body.plugins = options.plugins;
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "x-title": "ohio-claims",
      "http-referer": "https://ohio-claims.pages.dev",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as any;
  const message = data.choices?.[0]?.message;
  const text = message?.content ?? "";
  const reasoning = message?.reasoning ?? undefined;

  let citations: UrlCitation[] | undefined;
  if (Array.isArray(message?.annotations)) {
    citations = message.annotations
      .filter((a: any) => a.type === "url_citation" && a.url_citation?.url)
      .map((a: any) => ({
        url: a.url_citation.url,
        title: a.url_citation.title,
        content: a.url_citation.content,
        start_index: a.url_citation.start_index,
        end_index: a.url_citation.end_index,
      }));
    if (citations!.length === 0) citations = undefined;
  }

  return {
    text,
    model: data.model ?? model,
    reasoning,
    usage: data.usage,
    citations,
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

export function loadSystemPrompt(agentId: string): string {
  try {
    return readFileSync(resolve(AGENTS_DIR, agentId, "SYSTEM_PROMPT.md"), "utf-8");
  } catch {
    return `You are the ${agentId} agent. Respond ONLY with valid JSON matching your OUTPUT_SCHEMA. No markdown, no code fences, no explanation text.`;
  }
}

export async function runAgent(
  agentId: string,
  message: string,
  sessionId?: string,
  options: AgentCallOptions = {}
): Promise<AgentResponse> {
  if (GATEWAY_URL) {
    return callGateway(agentId, message, sessionId);
  }

  const systemPrompt = loadSystemPrompt(agentId);
  return callOpenRouterDirect(systemPrompt, message, options);
}

export async function webSearchForPricing(query: string): Promise<AgentResponse> {
  const systemPrompt = "You are a helpful research assistant. Find real current prices from real websites. For each price you find, include the full URL where you found it. Be specific and factual.";
  return callOpenRouterDirect(systemPrompt, query, {
    model: DEFAULT_MODEL,
    plugins: [{
      id: "web",
      max_results: 10,
      search_prompt: "Web search results for auto parts pricing and labor rates. Use these results to provide accurate, sourced pricing data:",
    }],
  });
}

export type ImagePart = {
  base64: string;
  mimeType: string;
  filename: string;
};

const VISION_MODEL = process.env.VISION_MODEL ?? "google/gemini-2.0-flash-001";

export async function analyzeImagesWithVision(
  systemPrompt: string,
  textPrompt: string,
  images: ImagePart[],
): Promise<AgentResponse> {
  const contentParts: any[] = [{ type: "text", text: textPrompt }];
  for (const img of images) {
    contentParts.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }

  const body = {
    model: VISION_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentParts },
    ],
    max_tokens: 4000,
    temperature: 0.1,
  };

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "x-title": "ohio-claims-image-analyzer",
      "http-referer": "https://ohio-claims.pages.dev",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vision model failed (${res.status}): ${errText}`);
  }

  const data = await res.json() as any;
  const message = data.choices?.[0]?.message;
  return {
    text: message?.content ?? "",
    model: data.model ?? VISION_MODEL,
    usage: data.usage,
  };
}
