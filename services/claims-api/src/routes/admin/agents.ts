import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";

export async function adminAgentsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  app.get("/admin/agents", async () => {
    const agents = await db.getAllAgents();
    return { agents };
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
