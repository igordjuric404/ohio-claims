/**
 * In-memory storage implementation for local development/testing.
 * Drop-in replacement for dynamo.ts when AWS is not configured.
 */

const claims = new Map<string, Record<string, unknown>>();
const events = new Map<string, Array<Record<string, unknown>>>();

export async function putClaim(claim: Record<string, unknown>) {
  claims.set(claim.claim_id as string, { ...claim });
}

export async function getClaim(claimId: string) {
  return claims.get(claimId) ?? null;
}

export async function updateClaimStage(claimId: string, stage: string) {
  const claim = claims.get(claimId);
  if (claim) {
    claim.stage = stage;
    claim.updated_at = new Date().toISOString();
  }
}

export async function putEvent(event: Record<string, unknown>) {
  const claimId = event.claim_id as string;
  if (!events.has(claimId)) events.set(claimId, []);
  events.get(claimId)!.push({ ...event });
}

export async function getLastEvent(claimId: string) {
  const list = events.get(claimId) ?? [];
  return list.length > 0 ? list[list.length - 1] : null;
}

export async function getEvents(claimId: string) {
  return events.get(claimId) ?? [];
}
