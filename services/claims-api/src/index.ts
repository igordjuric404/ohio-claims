import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { initEncryption } from "./crypto/encrypt.js";
import { claimsRoutes } from "./routes/claims.js";
import { runsRoutes } from "./routes/runs.js";
import { adminAuthRoutes } from "./routes/admin/auth.js";
import { adminOverviewRoutes } from "./routes/admin/overview.js";
import { adminClaimsRoutes } from "./routes/admin/claims.js";
import { adminRunsRoutes } from "./routes/admin/runs.js";
import { adminAuditRoutes } from "./routes/admin/audit.js";
import { adminUsageRoutes } from "./routes/admin/usage.js";
import { adminAgentsRoutes } from "./routes/admin/agents.js";
import { intakeRoutes } from "./routes/intake.js";
import { assessmentRoutes } from "./routes/assessment.js";
import { setAdminPassword } from "./middleware/adminAuth.js";

const masterKey = process.env.APP_MASTER_KEY_B64;
if (masterKey) {
  initEncryption(masterKey);
} else {
  console.warn("APP_MASTER_KEY_B64 not set — using test key (NOT FOR PRODUCTION)");
  const testKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
  initEncryption(testKey);
}

const adminPw = process.env.ADMIN_PASSWORD;
if (adminPw) {
  setAdminPassword(adminPw);
  console.log("Admin password loaded from environment");
} else {
  setAdminPassword("admin-dev-password");
  console.warn("ADMIN_PASSWORD not set — using default dev password");
}

const app = Fastify({ logger: true });

await app.register(cookie);

app.get("/healthz", async () => ({ ok: true }));
app.get("/edge/ping", async () => ({ pong: true }));

await app.register(claimsRoutes);
await app.register(runsRoutes);
await app.register(adminAuthRoutes);
await app.register(adminOverviewRoutes);
await app.register(adminClaimsRoutes);
await app.register(adminRunsRoutes);
await app.register(adminAuditRoutes);
await app.register(adminUsageRoutes);
await app.register(adminAgentsRoutes);
await app.register(intakeRoutes);
await app.register(assessmentRoutes);

const port = Number(process.env.PORT ?? "8080");
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`Claims API listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
