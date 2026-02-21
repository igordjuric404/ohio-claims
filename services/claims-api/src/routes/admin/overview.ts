import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";

export async function adminOverviewRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  app.get("/admin/overview", async (req) => {
    const { items: claims } = await db.scanClaims(1000);
    const { items: runs } = await db.scanRuns(1000);

    const totalClaims = claims.length;
    const claimsByStage: Record<string, number> = {};
    for (const c of claims) {
      const stage = c.stage as string;
      claimsByStage[stage] = (claimsByStage[stage] ?? 0) + 1;
    }

    const totalRuns = runs.length;
    const runsByStatus: Record<string, number> = {};
    const runsByAgent: Record<string, number> = {};
    let totalTokens = 0;
    let totalDurationMs = 0;
    for (const r of runs) {
      const status = r.status as string;
      const agent = r.agent_id as string;
      runsByStatus[status] = (runsByStatus[status] ?? 0) + 1;
      runsByAgent[agent] = (runsByAgent[agent] ?? 0) + 1;
      if (r.usage && typeof r.usage === "object") {
        totalTokens += (r.usage as any).total_tokens ?? 0;
      }
      if (r.duration_ms) totalDurationMs += r.duration_ms as number;
    }

    return {
      total_claims: totalClaims,
      claims_by_stage: claimsByStage,
      total_runs: totalRuns,
      runs_by_status: runsByStatus,
      runs_by_agent: runsByAgent,
      total_tokens: totalTokens,
      total_duration_ms: totalDurationMs,
      avg_run_duration_ms: totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0,
    };
  });
}
