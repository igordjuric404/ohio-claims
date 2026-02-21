const API = "http://127.0.0.1:8099";

let adminCookie = "";

async function getAdminCookie(): Promise<string> {
  if (adminCookie) return adminCookie;
  const res = await fetch(`${API}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "admin-dev-password" }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  adminCookie = setCookie.split(";")[0];
  return adminCookie;
}

export async function seedAgentsViaApi(): Promise<void> {
  const cookie = await getAdminCookie();
  await fetch(`${API}/admin/agents/seed`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
}

export async function createTestClaim(): Promise<string> {
  const res = await fetch(`${API}/edge/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      policy_id: "POL-TEST-E2E-001",
      claimant: {
        full_name: "Jane Test",
        phone: "(614) 555-9999",
        email: "jane@test.local",
        address: "123 Test St, Columbus, OH 43215",
      },
      loss: {
        date_of_loss: "2026-02-10",
        city: "Columbus",
        description: "Rear-ended at red light. Bumper damage.",
      },
      vehicle: { vin: "5YJSA1E23LF000001", year: 2022, make: "Honda", model: "Accord" },
    }),
  });
  const data = await res.json();
  return data.claim_id;
}

export async function seedReviewedClaim(): Promise<string> {
  const res = await fetch(`${API}/internal/test/seed-reviewed-claim`, {
    method: "POST",
  });
  const data = await res.json();
  return data.claim_id;
}

export async function purgeAllData(): Promise<void> {
  const cookie = await getAdminCookie();
  await Promise.all([
    fetch(`${API}/admin/claims/purge-all`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }),
    fetch(`${API}/admin/runs/purge-all`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }),
  ]);
}
