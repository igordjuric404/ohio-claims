import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";

export async function adminClaimsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  app.get("/admin/claims", async (req) => {
    const q = req.query as Record<string, string>;
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const cursor = q.cursor ? JSON.parse(Buffer.from(q.cursor, "base64url").toString()) : undefined;

    const { items, lastKey } = await db.scanClaims(limit, cursor);

    let filtered = items;
    if (q.stage) filtered = filtered.filter((c) => c.stage === q.stage);
    if (q.search) {
      const s = q.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          (c.claim_id as string).toLowerCase().includes(s) ||
          (c.policy_id as string).toLowerCase().includes(s)
      );
    }

    return {
      claims: filtered,
      cursor: lastKey ? Buffer.from(JSON.stringify(lastKey)).toString("base64url") : null,
    };
  });

  app.get("/admin/claims/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const claim = await db.getClaim(id);
    if (!claim) return reply.code(404).send({ error: "Claim not found" });
    const events = await db.getEvents(id);
    const runs = await db.getRunsForClaim(id);
    return { claim, events, runs };
  });
}
