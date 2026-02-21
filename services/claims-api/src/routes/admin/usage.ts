import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";

export async function adminUsageRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  app.get("/admin/usage", async (req) => {
    const q = req.query as Record<string, string>;
    const groupBy = q.group_by ?? "agent";

    const { items: runs } = await db.scanRuns(1000);

    const groups: Record<string, { runs: number; tokens: number; duration_ms: number }> = {};

    for (const r of runs) {
      let key: string;
      switch (groupBy) {
        case "stage":
          key = r.stage as string;
          break;
        case "day":
          key = (r.started_at as string).split("T")[0];
          break;
        default:
          key = r.agent_id as string;
      }

      if (!groups[key]) groups[key] = { runs: 0, tokens: 0, duration_ms: 0 };
      groups[key].runs++;
      if (r.usage && typeof r.usage === "object") {
        groups[key].tokens += (r.usage as any).total_tokens ?? 0;
      }
      if (r.duration_ms) groups[key].duration_ms += r.duration_ms as number;
    }

    return { group_by: groupBy, data: groups };
  });
}
