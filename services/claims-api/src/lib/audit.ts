import { createHash } from "node:crypto";
import { nanoid } from "nanoid";

export function computeEventHash(event: Record<string, unknown>): string {
  const payload = JSON.stringify({
    claim_id: event.claim_id,
    event_sk: event.event_sk,
    created_at: event.created_at,
    stage: event.stage,
    type: event.type,
    data: event.data,
    prev_hash: event.prev_hash ?? "",
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function createEventSK(stage: string): string {
  const ts = new Date().toISOString();
  return `${ts}#${stage}#${nanoid(8)}`;
}
