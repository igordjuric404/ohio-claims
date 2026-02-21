const BASE = '/api';

export type CreateClaimPayload = {
  policy_id: string;
  claimant: {
    full_name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  loss: {
    date_of_loss: string;
    city?: string;
    description: string;
  };
  vehicle: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
  };
};

export type CreateClaimResponse = {
  claim_id: string;
  stage: string;
  compliance: {
    ack_due_at: string;
  };
};

export type Claim = {
  claim_id: string;
  created_at: string;
  updated_at: string;
  policy_id: string;
  claimant: {
    full_name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  loss: {
    date_of_loss: string;
    state: string;
    city?: string;
    description: string;
  };
  vehicle: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
  };
  stage: string;
  compliance: {
    ack_due_at: string;
    accept_deny_due_at?: string;
    next_status_update_due_at?: string;
    payment_due_at?: string;
  };
  attachments?: string[];
};

export type ClaimEvent = {
  claim_id: string;
  event_sk: string;
  created_at: string;
  stage: string;
  type: string;
  data: unknown;
  prev_hash?: string;
  hash: string;
};

export type PipelineResult = {
  claim_id: string;
  final_stage: string;
  stages_completed: string[];
  errors: string[];
  stage_outputs: Record<string, unknown>;
};

export type PresignResponse = {
  upload_url: string;
  key: string;
};

async function fetchApi(
  url: string,
  opts?: RequestInit
): Promise<Response> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  return res;
}

export async function createClaim(data: CreateClaimPayload): Promise<CreateClaimResponse> {
  const res = await fetchApi('/claims', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function getClaim(id: string): Promise<{ claim: Claim; events: ClaimEvent[] }> {
  const res = await fetchApi(`/claims/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function runPipeline(id: string): Promise<PipelineResult> {
  const res = await fetchApi(`/claims/${id}/run`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function presignUpload(
  id: string,
  filename: string,
  contentType?: string
): Promise<PresignResponse> {
  const res = await fetchApi(`/claims/${id}/attachments/presign`, {
    method: 'POST',
    body: JSON.stringify({ filename, content_type: contentType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}
