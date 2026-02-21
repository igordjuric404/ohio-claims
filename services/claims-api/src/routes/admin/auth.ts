import type { FastifyInstance } from "fastify";
import {
  createSession,
  getSessionFromRequest,
  COOKIE_NAME,
  SESSION_MAX_AGE_S,
} from "../../middleware/adminAuth.js";

export async function adminAuthRoutes(app: FastifyInstance) {
  app.post("/admin/login", async (req, reply) => {
    const { cookie, maxAge } = createSession("admin");
    reply.setCookie(COOKIE_NAME, cookie, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
    });

    return { ok: true, actor_id: "admin", role: "admin" };
  });

  app.post("/admin/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/admin/me", async (req, reply) => {
    const session = getSessionFromRequest(req);
    if (!session) return reply.code(401).send({ error: "Not authenticated" });
    return session;
  });
}
