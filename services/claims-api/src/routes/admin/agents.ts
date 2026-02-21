import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";

export async function adminAgentsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  app.get("/admin/agents", async () => {
    const agents = await db.getAllAgents();
    return { agents };
  });

  app.post("/admin/agents/seed", async (_req, reply) => {
    const PIPELINE_AGENTS = [
      { agent_id: "frontdesk", display_name: "Front Desk", pipeline_stage: "FRONTDESK_DONE", model_primary: "google/gemini-2.0-flash-001", tool_allowlist: [], description: "Validates initial FNOL data, normalizes fields, flags missing info." },
      { agent_id: "claimsofficer", display_name: "Claims Officer", pipeline_stage: "COVERAGE_DONE", model_primary: "google/gemini-2.0-flash-001", tool_allowlist: [], description: "Verifies policy coverage, checks exclusions, determines eligibility." },
      { agent_id: "assessor", display_name: "Assessor", pipeline_stage: "ASSESSMENT_DONE", model_primary: "google/gemini-2.0-flash-001", tool_allowlist: ["searchParts", "getLocalLaborRate"], description: "Estimates repair costs, parts pricing, labor totals." },
      { agent_id: "fraudanalyst", display_name: "Fraud Analyst", pipeline_stage: "FRAUD_DONE", model_primary: "google/gemini-2.0-flash-001", tool_allowlist: [], description: "Checks for fraud indicators, risk scoring, anomaly detection." },
      { agent_id: "seniorreviewer", display_name: "Senior Reviewer", pipeline_stage: "FINAL_DECISION_DONE", model_primary: "google/gemini-2.0-flash-001", tool_allowlist: [], description: "Makes final approve/deny decision with rationale." },
      { agent_id: "finance", display_name: "Finance", pipeline_stage: "PAID", model_primary: "google/gemini-2.0-flash-001", tool_allowlist: [], description: "Processes payment authorization and generates payment record." },
    ];
    let seeded = 0;
    for (const a of PIPELINE_AGENTS) {
      const existing = await db.getAgent(a.agent_id);
      if (!existing) {
        await db.putAgent({ ...a, enabled: true, status: "idle", prompt_version: "v1", updated_at: new Date().toISOString() });
        seeded++;
      }
    }
    return { seeded, total: PIPELINE_AGENTS.length, message: `Seeded ${seeded} new agents` };
  });

  app.post("/admin/agents", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    if (!body.agent_id) return reply.code(400).send({ error: "agent_id required" });

    const agent = {
      agent_id: body.agent_id,
      display_name: body.display_name ?? body.agent_id,
      enabled: body.enabled ?? true,
      model_primary: body.model_primary ?? "google/gemini-2.0-flash-001",
      model_fallbacks: body.model_fallbacks ?? [],
      tool_allowlist: body.tool_allowlist ?? [],
      prompt_version: body.prompt_version ?? "v1",
      updated_at: new Date().toISOString(),
    };
    await db.putAgent(agent);
    return reply.code(201).send(agent);
  });

  app.patch("/admin/agents/:agent_id", async (req, reply) => {
    const { agent_id } = req.params as { agent_id: string };
    const existing = await db.getAgent(agent_id);
    if (!existing) return reply.code(404).send({ error: "Agent not found" });

    const body = req.body as Record<string, unknown>;
    const updated = {
      ...existing,
      ...body,
      agent_id,
      updated_at: new Date().toISOString(),
    };
    await db.putAgent(updated);
    return updated;
  });

  app.post("/admin/agents/:agent_id/reload", async (req, reply) => {
    const { agent_id } = req.params as { agent_id: string };
    const agent = await db.getAgent(agent_id);
    if (!agent) return reply.code(404).send({ error: "Agent not found" });

    return {
      ok: true,
      agent_id,
      note: "Agent config updated in database. OpenClaw gateway reload is handled separately on EC2.",
    };
  });
}
