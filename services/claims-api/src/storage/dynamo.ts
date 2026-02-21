import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const raw = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

const CLAIMS_TABLE = process.env.DDB_CLAIMS_TABLE ?? "ohio-claims-dev-Claims";
const EVENTS_TABLE = process.env.DDB_EVENTS_TABLE ?? "ohio-claims-dev-ClaimEvents";

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
