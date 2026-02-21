import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  DeleteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

if (process.env.USE_MEMORY_STORAGE === "true") {
  console.log("Using in-memory storage (no DynamoDB)");
}

const raw = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

const CLAIMS_TABLE = process.env.DDB_CLAIMS_TABLE ?? "ohio-claims-dev-Claims";
const EVENTS_TABLE = process.env.DDB_EVENTS_TABLE ?? "ohio-claims-dev-ClaimEvents";
const RUNS_TABLE = process.env.DDB_RUNS_TABLE ?? "ohio-claims-dev-Runs";
const RUN_EVENTS_TABLE = process.env.DDB_RUN_EVENTS_TABLE ?? "ohio-claims-dev-RunEvents";
const AGENTS_TABLE = process.env.DDB_AGENTS_TABLE ?? "ohio-claims-dev-Agents";
const INTAKE_JOBS_TABLE = process.env.DDB_INTAKE_JOBS_TABLE ?? "ohio-claims-dev-IntakeJobs";

export async function putClaim(claim: Record<string, unknown>) {
  await ddb.send(new PutCommand({ TableName: CLAIMS_TABLE, Item: claim }));
}

export async function getClaim(claimId: string) {
  const res = await ddb.send(
    new GetCommand({ TableName: CLAIMS_TABLE, Key: { claim_id: claimId } })
  );
  return res.Item ?? null;
}

export async function updateClaimStage(claimId: string, stage: string) {
  await ddb.send(
    new UpdateCommand({
      TableName: CLAIMS_TABLE,
      Key: { claim_id: claimId },
      UpdateExpression: "SET stage = :s, updated_at = :u",
      ExpressionAttributeValues: { ":s": stage, ":u": new Date().toISOString() },
    })
  );
}

export async function putEvent(event: Record<string, unknown>) {
  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: event }));
}

export async function getLastEvent(claimId: string) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "claim_id = :cid",
      ExpressionAttributeValues: { ":cid": claimId },
      ScanIndexForward: false,
      Limit: 1,
    })
  );
  return res.Items?.[0] ?? null;
}

export async function getEvents(claimId: string) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "claim_id = :cid",
      ExpressionAttributeValues: { ":cid": claimId },
      ScanIndexForward: true,
    })
  );
  return res.Items ?? [];
}

// --- Runs ---

export async function putRun(run: Record<string, unknown>) {
  await ddb.send(new PutCommand({ TableName: RUNS_TABLE, Item: run }));
}

export async function getRun(runId: string) {
  const res = await ddb.send(
    new GetCommand({ TableName: RUNS_TABLE, Key: { run_id: runId } })
  );
  return res.Item ?? null;
}

export async function updateRunStatus(
  runId: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  let expr = "SET #st = :s, #ua = :u";
  const names: Record<string, string> = { "#st": "status", "#ua": "updated_at" };
  const vals: Record<string, unknown> = { ":s": status, ":u": new Date().toISOString() };

  let idx = 0;
  for (const [k, v] of Object.entries(extra)) {
    const alias = `#f${idx}`;
    const valAlias = `:f${idx}`;
    expr += `, ${alias} = ${valAlias}`;
    names[alias] = k;
    vals[valAlias] = v;
    idx++;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: RUNS_TABLE,
      Key: { run_id: runId },
      UpdateExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: vals,
    })
  );
}

export async function getRunsForClaim(claimId: string) {
  const res = await ddb.send(
    new ScanCommand({
      TableName: RUNS_TABLE,
      FilterExpression: "claim_id = :cid",
      ExpressionAttributeValues: { ":cid": claimId },
    })
  );
  return (res.Items ?? []).sort(
    (a, b) => (a.started_at as string).localeCompare(b.started_at as string)
  );
}

// --- RunEvents ---

export async function putRunEvent(event: Record<string, unknown>) {
  await ddb.send(new PutCommand({ TableName: RUN_EVENTS_TABLE, Item: event }));
}

export async function getRunEvents(runId: string, fromSeq = 0) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: RUN_EVENTS_TABLE,
      KeyConditionExpression: "run_id = :rid AND seq > :s",
      ExpressionAttributeValues: { ":rid": runId, ":s": fromSeq },
      ScanIndexForward: true,
    })
  );
  return res.Items ?? [];
}

// --- Agents ---

export async function putAgent(agent: Record<string, unknown>) {
  await ddb.send(new PutCommand({ TableName: AGENTS_TABLE, Item: agent }));
}

export async function getAgent(agentId: string) {
  const res = await ddb.send(
    new GetCommand({ TableName: AGENTS_TABLE, Key: { agent_id: agentId } })
  );
  return res.Item ?? null;
}

export async function getAllAgents() {
  const res = await ddb.send(new ScanCommand({ TableName: AGENTS_TABLE }));
  return res.Items ?? [];
}

// --- Claims scan (admin) ---

export async function scanClaims(limit = 50, startKey?: Record<string, unknown>) {
  const res = await ddb.send(
    new ScanCommand({
      TableName: CLAIMS_TABLE,
      Limit: limit,
      ExclusiveStartKey: startKey as any,
    })
  );
  return { items: res.Items ?? [], lastKey: res.LastEvaluatedKey };
}

// --- Runs scan (admin) ---

export async function scanRuns(limit = 50, startKey?: Record<string, unknown>) {
  const res = await ddb.send(
    new ScanCommand({
      TableName: RUNS_TABLE,
      Limit: limit,
      ExclusiveStartKey: startKey as any,
    })
  );
  return { items: res.Items ?? [], lastKey: res.LastEvaluatedKey };
}

// --- IntakeJobs ---

export async function putIntakeJob(job: Record<string, unknown>) {
  await ddb.send(new PutCommand({ TableName: INTAKE_JOBS_TABLE, Item: job }));
}

export async function getIntakeJob(jobId: string) {
  const res = await ddb.send(
    new GetCommand({ TableName: INTAKE_JOBS_TABLE, Key: { intake_job_id: jobId } })
  );
  return res.Item ?? null;
}

export async function updateIntakeJob(jobId: string, updates: Record<string, unknown>) {
  let expr = "SET";
  const names: Record<string, string> = {};
  const vals: Record<string, unknown> = {};
  let idx = 0;
  for (const [k, v] of Object.entries(updates)) {
    if (idx > 0) expr += ",";
    const alias = `#ij${idx}`;
    const valAlias = `:ij${idx}`;
    expr += ` ${alias} = ${valAlias}`;
    names[alias] = k;
    vals[valAlias] = v;
    idx++;
  }
  if (idx === 0) return;
  await ddb.send(
    new UpdateCommand({
      TableName: INTAKE_JOBS_TABLE,
      Key: { intake_job_id: jobId },
      UpdateExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: vals,
    })
  );
}

export async function scanIntakeJobs(limit = 50) {
  const res = await ddb.send(
    new ScanCommand({ TableName: INTAKE_JOBS_TABLE, Limit: limit })
  );
  return res.Items ?? [];
}

async function batchDeleteAll(table: string, keyExtractor: (item: Record<string, unknown>) => Record<string, unknown>) {
  let lastKey: Record<string, unknown> | undefined;
  let total = 0;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: table, Limit: 25, ExclusiveStartKey: lastKey as any }));
    const items = res.Items ?? [];
    if (items.length === 0) break;
    const batches: Record<string, unknown>[][] = [];
    for (let i = 0; i < items.length; i += 25) batches.push(items.slice(i, i + 25));
    for (const batch of batches) {
      await ddb.send(new BatchWriteCommand({
        RequestItems: {
          [table]: batch.map(item => ({ DeleteRequest: { Key: keyExtractor(item) } })),
        },
      }));
      total += batch.length;
    }
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return total;
}

export async function purgeAllClaims() {
  const claimsDel = await batchDeleteAll(CLAIMS_TABLE, i => ({ claim_id: i.claim_id }));
  const eventsDel = await batchDeleteAll(EVENTS_TABLE, i => ({ claim_id: i.claim_id, event_sk: i.event_sk }));
  return { claims: claimsDel, events: eventsDel };
}

export async function purgeAllRuns() {
  const runsDel = await batchDeleteAll(RUNS_TABLE, i => ({ run_id: i.run_id }));
  const eventsDel = await batchDeleteAll(RUN_EVENTS_TABLE, i => ({ run_id: i.run_id, seq: i.seq }));
  return { runs: runsDel, run_events: eventsDel };
}
