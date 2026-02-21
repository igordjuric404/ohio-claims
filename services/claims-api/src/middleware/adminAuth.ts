import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? randomBytes(32).toString("hex");
const SESSION_MAX_AGE_S = 12 * 60 * 60; // 12 hours
const COOKIE_NAME = "admin_session";

export type UserRole = "admin" | "reviewer";

let adminPasswordHash: string | null = null;
let reviewerPasswordHash: string | null = null;

export function setAdminPassword(password: string) {
  adminPasswordHash = hashPassword(password);
}

export function setReviewerPassword(password: string) {
  reviewerPasswordHash = hashPassword(password);
}

function hashPassword(pw: string): string {
  return createHmac("sha256", SESSION_SECRET).update(pw).digest("hex");
}

function signPayload(payload: string): string {
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyPayload(token: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.substring(0, lastDot);
  const sig = token.substring(lastDot + 1);
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  return payload;
}

export function createSession(actorId: string, role: UserRole = "admin"): { cookie: string; maxAge: number } {
  const payload = JSON.stringify({
    actor_id: actorId,
    role,
    issued_at: new Date().toISOString(),
    exp: Date.now() + SESSION_MAX_AGE_S * 1000,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return { cookie: signPayload(encoded), maxAge: SESSION_MAX_AGE_S };
}

export function validatePassword(password: string): boolean {
  if (!adminPasswordHash) return false;
  const inputHash = hashPassword(password);
  try {
    return timingSafeEqual(Buffer.from(adminPasswordHash, "hex"), Buffer.from(inputHash, "hex"));
  } catch {
    return false;
  }
}

export function validateReviewerPassword(password: string): boolean {
  if (!reviewerPasswordHash) return false;
  const inputHash = hashPassword(password);
  try {
    return timingSafeEqual(Buffer.from(reviewerPasswordHash, "hex"), Buffer.from(inputHash, "hex"));
  } catch {
    return false;
  }
}

export function getSessionFromRequest(req: FastifyRequest): { actor_id: string; role: UserRole } | null {
  const token = (req.cookies as Record<string, string>)?.[COOKIE_NAME];
  if (!token) return null;
  const payload = verifyPayload(token);
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp && data.exp < Date.now()) return null;
    return { actor_id: data.actor_id, role: data.role };
  } catch {
    return null;
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const session = getSessionFromRequest(req);
  if (!session || session.role !== "admin") {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (req as any).adminSession = session;
}

export async function requireReviewer(req: FastifyRequest, reply: FastifyReply) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== "reviewer" && session.role !== "admin")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  (req as any).reviewerSession = session;
}

export { COOKIE_NAME, SESSION_MAX_AGE_S };
