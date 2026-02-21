import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, "../../../../../test-cases/results");

export async function adminTestRunsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireAdmin);

  app.get("/admin/test-runs", async () => {
    if (!existsSync(RESULTS_DIR)) return { versions: [] };
    const dirs = readdirSync(RESULTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
      .reverse();
    return { versions: dirs };
  });

  app.get("/admin/test-runs/:version", async (req, reply) => {
    const { version } = req.params as { version: string };
    const versionDir = resolve(RESULTS_DIR, version);
    if (!existsSync(versionDir)) return reply.code(404).send({ error: "Version not found" });

    const summaryPath = resolve(versionDir, "summary.json");
    if (existsSync(summaryPath)) {
      const data = JSON.parse(readFileSync(summaryPath, "utf-8"));
      return data;
    }

    const files = readdirSync(versionDir)
      .filter(f => f.startsWith("TC") && f.endsWith(".json"))
      .sort();

    const results = files.map(f => JSON.parse(readFileSync(resolve(versionDir, f), "utf-8")));
    return {
      version,
      total: results.length,
      passed: results.filter((r: any) => r.match).length,
      failed: results.filter((r: any) => !r.match && !r.error).length,
      errors: results.filter((r: any) => r.error).length,
      results,
    };
  });
}
