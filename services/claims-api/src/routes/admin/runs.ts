import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import * as db from "../../storage/index.js";

export async function adminRunsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  app.get("/admin/runs", async (req) => {
    const q = req.query as Record<string, string>;
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const cursor = q.cursor ? JSON.parse(Buffer.from(q.cursor, "base64url").toString()) : undefined;

    const { items, lastKey } = await db.scanRuns(limit, cursor);

    let filtered = items;
    if (q.agent_id) filtered = filtered.filter((r) => r.agent_id === q.agent_id);
    if (q.stage) filtered = filtered.filter((r) => r.stage === q.stage);
    if (q.status) filtered = filtered.filter((r) => r.status === q.status);

    return {
      runs: filtered,
      cursor: lastKey ? Buffer.from(JSON.stringify(lastKey)).toString("base64url") : null,
    };
  });

  app.get("/admin/runs/:run_id", async (req, reply) => {
    const { run_id } = req.params as { run_id: string };
    const run = await db.getRun(run_id);
    if (!run) return reply.code(404).send({ error: "Run not found" });
    const events = await db.getRunEvents(run_id);
    return { run, events };
  });

  app.get("/admin/runs/:run_id/events", async (req) => {
    const { run_id } = req.params as { run_id: string };
    const fromSeq = Number((req.query as any).from_seq ?? 0);
    const events = await db.getRunEvents(run_id, fromSeq);
    return { events };
  });

  app.post("/admin/runs/cleanup-stale", async (_req, reply) => {
    const { items: runs } = await db.scanRuns(1000);
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    let cleaned = 0;
    for (const r of runs) {
      if (r.status !== "RUNNING") continue;
      const startedAt = r.started_at ? new Date(r.started_at as string).getTime() : 0;
      if (startedAt < fiveMinAgo) {
        await db.updateRunStatus(r.run_id as string, "FAILED", {
          ended_at: new Date().toISOString(),
          error: "stale — cleaned up (orphaned RUNNING state)",
        });
        cleaned++;
      }
    }
    return { cleaned, message: `Marked ${cleaned} stale runs as FAILED` };
  });

  app.delete("/admin/runs/purge-all", async () => {
    const result = await db.purgeAllRuns();
    return { ...result, message: `Purged ${result.runs} runs and ${result.run_events} run events` };
  }); 

  app.get("/admin/runs/:run_id/stream", async (req, reply) => {
    const { run_id } = req.params as { run_id: string };
    const fromSeq = Number((req.query as any).from_seq ?? 0);

    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    let lastSeq = fromSeq;
    let attempts = 0;
    const maxAttempts = 120; // ~60s with 500ms intervals

    const poll = async () => {
      while (attempts < maxAttempts) {
        const events = await db.getRunEvents(run_id, lastSeq);
        for (const evt of events) {
          const seq = evt.seq as number;
          reply.raw.write(`event: ${evt.event_type}\ndata: ${JSON.stringify(evt)}\n\n`);
          if (seq > lastSeq) lastSeq = seq;
        }

        const run = await db.getRun(run_id);
        if (run && (run.status === "SUCCEEDED" || run.status === "FAILED")) {
          reply.raw.write(`event: done\ndata: ${JSON.stringify({ status: run.status })}\n\n`);
          break;
        }

        attempts++;
        await new Promise((r) => setTimeout(r, 500));
      }
      reply.raw.end();
    };

    poll().catch(() => reply.raw.end());
  });
}
