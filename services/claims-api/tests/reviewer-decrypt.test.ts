import { describe, it, expect, beforeAll } from "vitest";
import { initEncryption, encrypt, decrypt } from "../src/crypto/encrypt.js";

describe("Reviewer PII decryption", () => {
  beforeAll(() => {
    const testKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
    initEncryption(testKey);
  });

  it("encrypts and decrypts claimant name correctly", () => {
    const name = "Sarah Mitchell";
    const encrypted = encrypt(name);
    expect(encrypted).not.toBe(name);
    expect(encrypted.length).toBeGreaterThan(name.length);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(name);
  });

  it("encrypts and decrypts phone correctly", () => {
    const phone = "(614) 555-0237";
    const encrypted = encrypt(phone);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(phone);
  });

  it("encrypted values are base64 and significantly longer than plaintext", () => {
    const value = "test@email.com";
    const encrypted = encrypt(value);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(encrypted.length).toBeGreaterThan(value.length * 2);
  });

  it("decrypt fails gracefully on non-encrypted strings", () => {
    expect(() => decrypt("not-encrypted")).toThrow();
  });

  it("each encryption produces different ciphertext (random IV)", () => {
    const value = "same input";
    const a = encrypt(value);
    const b = encrypt(value);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(value);
    expect(decrypt(b)).toBe(value);
  });
});
