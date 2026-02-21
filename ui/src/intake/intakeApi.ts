const BASE = "/api";

async function fetchApi(url: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(opts?.headers as Record<string, string>) };
  if (opts?.body) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  return fetch(`${BASE}${url}`, { ...opts, headers });
}

export async function createIntakeJob(): Promise<{ intake_job_id: string; status: string }> {
  const res = await fetchApi("/intake/jobs", { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) throw new Error("Failed to create intake job");
  return res.json();
}

export async function presignIntakeFile(
  jobId: string,
  filename: string,
  contentType?: string
): Promise<{ upload_url: string; key: string }> {
  const res = await fetchApi(`/intake/jobs/${jobId}/files/presign`, {
    method: "POST",
    body: JSON.stringify({ filename, content_type: contentType }),
  });
  if (!res.ok) throw new Error("Failed to presign");
  return res.json();
}

export async function startExtraction(jobId: string): Promise<any> {
  const res = await fetchApi(`/intake/jobs/${jobId}/extract`, { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) throw new Error("Failed to start extraction");
  return res.json();
}

export async function getIntakeJob(jobId: string): Promise<any> {
  const res = await fetchApi(`/intake/jobs/${jobId}`);
  if (!res.ok) throw new Error("Failed to get intake job");
  return res.json();
}

export async function confirmIntake(jobId: string, fields: Record<string, unknown>): Promise<any> {
  const res = await fetchApi(`/intake/jobs/${jobId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error("Failed to confirm intake");
  return res.json();
}
