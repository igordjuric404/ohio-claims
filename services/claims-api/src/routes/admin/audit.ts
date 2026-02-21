import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";

export async function adminAuditRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  app.get("/admin/audit", async (req) => {
    const q = req.query as Record<string, string>;
    const claimId = q.claim_id;

    if (!claimId) {
      return { events: [], note: "Provide claim_id query parameter to fetch audit events" };
    }

    const events = await db.getEvents(claimId);
    let filtered = events;

    if (q.event_type) filtered = filtered.filter((e) => e.type === q.event_type);
    if (q.actor_id) filtered = filtered.filter((e) => e.actor_id === q.actor_id);

    const limit = Math.min(Number(q.limit ?? 100), 500);
    return { events: filtered.slice(0, limit) };
  });
}
