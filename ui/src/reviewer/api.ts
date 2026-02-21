const BASE = "/api/reviewer";

async function reviewerFetch(url: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(opts?.headers as Record<string, string>) };
  if (opts?.body) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  return fetch(`${BASE}${url}`, { ...opts, headers, credentials: "include" });
}

export const reviewerApi = {
  async login(password: string) {
    const res = await reviewerFetch("/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    return res.json();
  },

  async logout() {
    await reviewerFetch("/logout", { method: "POST" });
  },

  async getMe() {
    const res = await reviewerFetch("/me");
    if (!res.ok) return null;
    return res.json();
  },

  async getClaims(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const res = await reviewerFetch(`/claims${qs}`);
    if (!res.ok) throw new Error("Failed to load claims");
    return res.json();
  },

  async getClaimDetail(id: string) {
    const res = await reviewerFetch(`/claims/${id}`);
    if (!res.ok) throw new Error("Claim not found");
    return res.json();
  },

  async getClaimPhotos(id: string): Promise<{ photos: { key: string; filename: string; url: string }[] }> {
    const res = await reviewerFetch(`/claims/${id}/photos`);
    if (!res.ok) return { photos: [] };
    return res.json();
  },

  async submitDecision(id: string, decision: {
    decision: "approve" | "deny";
    rationale: string;
    approve_amount_cap?: number;
  }) {
    const res = await reviewerFetch(`/claims/${id}/decision`, {
      method: "POST",
      body: JSON.stringify(decision),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Decision submission failed");
    }
    return res.json();
  },
};
