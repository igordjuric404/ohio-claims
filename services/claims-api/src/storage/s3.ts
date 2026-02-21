import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const BUCKET = process.env.S3_BUCKET ?? "ohio-claims-dev-attachments-422287833706-eu-central-1";

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

export async function getObjectAsBase64(key: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const buf = await res.Body?.transformToByteArray();
    if (!buf) return null;
    const ext = key.split(".").pop()?.toLowerCase() ?? "jpeg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return { base64: Buffer.from(buf).toString("base64"), mimeType };
  } catch {
    return null;
  }
}
