import type { FastifyInstance } from "fastify";
import {
  validateReviewerPassword,
  createSession,
  getSessionFromRequest,
  COOKIE_NAME,
} from "../../middleware/adminAuth.js";

export async function reviewerAuthRoutes(app: FastifyInstance) {
  app.post("/reviewer/login", async (req, reply) => {
    const { password } = (req.body ?? {}) as { password?: string };
    if (!password || !validateReviewerPassword(password)) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const { cookie, maxAge } = createSession("reviewer", "reviewer");
    reply.setCookie(COOKIE_NAME, cookie, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
    });

    return { ok: true, actor_id: "reviewer", role: "reviewer" };
  });

  app.post("/reviewer/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/reviewer/me", async (req, reply) => {
    const session = getSessionFromRequest(req);
    if (!session || (session.role !== "reviewer" && session.role !== "admin")) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    return session;
  });
}
