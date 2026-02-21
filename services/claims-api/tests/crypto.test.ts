import { describe, it, expect, beforeAll } from "vitest";
import { initEncryption, encrypt, decrypt } from "../src/crypto/encrypt.js";

beforeAll(() => {
  const testKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
  initEncryption(testKey);
});

describe("AES-256-GCM encryption", () => {
  it("roundtrips plaintext correctly", () => {
    const plain = "John Doe, 555-1234";
    const cipher = encrypt(plain);
    expect(cipher).not.toBe(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const plain = "same input";
    const c1 = encrypt(plain);
    const c2 = encrypt(plain);
    expect(c1).not.toBe(c2);
    expect(decrypt(c1)).toBe(plain);
    expect(decrypt(c2)).toBe(plain);
  });

  it("fails on tampered ciphertext", () => {
    const cipher = encrypt("sensitive");
    const buf = Buffer.from(cipher, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("handles empty string", () => {
    const cipher = encrypt("");
    expect(decrypt(cipher)).toBe("");
  });

  it("handles unicode", () => {
    const plain = "Jürgen Müller — 日本語テスト";
    const cipher = encrypt(plain);
    expect(decrypt(cipher)).toBe(plain);
  });
});
