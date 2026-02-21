import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let masterKey: Buffer | null = null;

export function initEncryption(keyB64: string) {
  masterKey = Buffer.from(keyB64, "base64");
  if (masterKey.length !== 32) {
    throw new Error("APP_MASTER_KEY_B64 must decode to exactly 32 bytes");
  }
}

function getKey(): Buffer {
  if (!masterKey) throw new Error("Encryption not initialized. Call initEncryption() first.");
  return masterKey;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(cipherB64: string): string {
  const buf = Buffer.from(cipherB64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
