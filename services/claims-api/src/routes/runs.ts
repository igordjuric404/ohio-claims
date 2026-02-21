import type { FastifyInstance } from "fastify";
import * as db from "../storage/index.js";

export async function runsRoutes(app: FastifyInstance) {
  app.get("/edge/claims/:id/runs", async (req) => {
    const { id } = req.params as { id: string };
    const runs = await db.getRunsForClaim(id);
    return { runs };
  });

  app.get("/edge/runs/:run_id", async (req, reply) => {
    const { run_id } = req.params as { run_id: string };
    const run = await db.getRun(run_id);
    if (!run) return reply.code(404).send({ error: "Run not found" });
    return run;
  });

  app.get("/edge/runs/:run_id/events", async (req) => {
    const { run_id } = req.params as { run_id: string };
    const fromSeq = Number((req.query as any).from_seq ?? 0);
    const events = await db.getRunEvents(run_id, fromSeq);
    return { events };
  });
}
