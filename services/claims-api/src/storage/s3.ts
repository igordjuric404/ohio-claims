import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET ?? "ohio-claims-dev-attachments";

export async function createPresignedUploadUrl(
  claimId: string,
  filename: string,
  contentType: string = "application/octet-stream"
): Promise<string> {
  const key = `claims/${claimId}/attachments/${filename}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

export async function listAttachments(claimId: string): Promise<string[]> {
  const prefix = `claims/${claimId}/attachments/`;
  const res = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return (res.Contents ?? []).map((o) => o.Key!);
}

export async function listByPrefix(prefix: string): Promise<string[]> {
  const res = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return (res.Contents ?? []).map((o) => o.Key!);
}

export async function createPresignedUploadUrlForKey(
  key: string,
  contentType: string = "application/octet-stream"
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 900 });
}

export async function createPresignedGetUrl(key: string, expiresIn = 600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}
