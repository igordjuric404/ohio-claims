const BASE = "/api/admin";

async function adminFetch(url: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(opts?.headers as Record<string, string>) };
  if (opts?.body) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  return fetch(`${BASE}${url}`, { ...opts, headers, credentials: "include" });
}

export async function login(password: string) {
  const res = await adminFetch("/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  return res.json();
}

export async function logout() {
  await adminFetch("/logout", { method: "POST" });
}

export async function getMe() {
  const res = await adminFetch("/me");
  if (!res.ok) return null;
  return res.json();
}

export async function getOverview() {
  const res = await adminFetch("/overview");
  if (!res.ok) throw new Error("Failed to load overview");
  return res.json();
}

export async function getClaims(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await adminFetch(`/claims${qs}`);
  if (!res.ok) throw new Error("Failed to load claims");
  return res.json();
}

export async function getClaimDetail(id: string) {
  const res = await adminFetch(`/claims/${id}`);
  if (!res.ok) throw new Error("Claim not found");
  return res.json();
}

export async function getClaimPhotos(id: string): Promise<{ photos: { key: string; filename: string; url: string }[] }> {
  const res = await adminFetch(`/claims/${id}/photos`);
  if (!res.ok) return { photos: [] };
  return res.json();
}

export async function getRuns(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await adminFetch(`/runs${qs}`);
  if (!res.ok) throw new Error("Failed to load runs");
  return res.json();
}

export async function getRunDetail(runId: string) {
  const res = await adminFetch(`/runs/${runId}`);
  if (!res.ok) throw new Error("Run not found");
  return res.json();
}

export async function getRunEvents(runId: string) {
  const res = await adminFetch(`/runs/${runId}/events`);
  if (!res.ok) throw new Error("Failed to load events");
  return res.json();
}

export async function getAudit(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await adminFetch(`/audit${qs}`);
  if (!res.ok) throw new Error("Failed to load audit");
  return res.json();
}

export async function getUsage(params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await adminFetch(`/usage${qs}`);
  if (!res.ok) throw new Error("Failed to load usage");
  return res.json();
}

export async function getAgents() {
  const res = await adminFetch("/agents");
  if (!res.ok) throw new Error("Failed to load agents");
  return res.json();
}

export async function createAgent(data: Record<string, unknown>) {
  const res = await adminFetch("/agents", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create agent");
  return res.json();
}

export async function seedAgents() {
  const res = await adminFetch("/agents/seed", { method: "POST" });
  if (!res.ok) throw new Error("Failed to seed agents");
  return res.json();
}

export async function cleanupStaleRuns() {
  const res = await adminFetch("/runs/cleanup-stale", { method: "POST" });
  if (!res.ok) throw new Error("Failed to cleanup stale runs");
  return res.json();
}

export async function purgeAllClaims() {
  const res = await adminFetch("/claims/purge-all", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to purge claims");
  return res.json();
}

export async function purgeAllRuns() {
  const res = await adminFetch("/runs/purge-all", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to purge runs");
  return res.json();
}

export async function getTestRuns() {
  const res = await adminFetch("/test-runs");
  if (!res.ok) throw new Error("Failed to load test runs");
  return res.json();
}

export async function getTestRunDetail(version: string) {
  const res = await adminFetch(`/test-runs/${encodeURIComponent(version)}`);
  if (!res.ok) throw new Error("Test run not found");
  return res.json();
}

export async function updateAgent(agentId: string, data: Record<string, unknown>) {
  const res = await adminFetch(`/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update agent");
  return res.json();
}
