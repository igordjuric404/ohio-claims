import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";
import { listByPrefix, createPresignedGetUrl } from "../../storage/s3.js";

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

  app.get("/admin/claims/:id/photos", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const keys = await listByPrefix(`claims/${id}/damage_photos/`);
      const photos = await Promise.all(
        keys.map(async (key) => ({
          key,
          filename: key.split("/").pop() ?? key,
          url: await createPresignedGetUrl(key, 3600),
        }))
      );
      return { photos };
    } catch (err: any) {
      return { photos: [], error: err.message };
    }
  });

  app.delete("/admin/claims/purge-all", async () => {
    const result = await db.purgeAllClaims();
    return { ...result, message: `Purged ${result.claims} claims and ${result.events} events` };
  });
}
