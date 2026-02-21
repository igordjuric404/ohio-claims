import Fastify from "fastify";
import { initEncryption } from "./crypto/encrypt.js";
import { claimsRoutes } from "./routes/claims.js";
import { runsRoutes } from "./routes/runs.js";

const masterKey = process.env.APP_MASTER_KEY_B64;
if (masterKey) {
  initEncryption(masterKey);
} else {
  console.warn("APP_MASTER_KEY_B64 not set — using test key (NOT FOR PRODUCTION)");
  const testKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
  initEncryption(testKey);
}

const app = Fastify({ logger: true });

app.get("/healthz", async () => ({ ok: true }));
app.get("/edge/ping", async () => ({ pong: true }));

await app.register(claimsRoutes);
await app.register(runsRoutes);

const port = Number(process.env.PORT ?? "8080");
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`Claims API listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
