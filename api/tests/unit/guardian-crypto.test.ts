import { describe, expect, it } from "vitest";

import {
  decryptAtRest,
  deriveSessionKeys,
  encryptAtRest,
  expectedProof,
  generateCode,
  generateSalt,
  hashToken,
  issueNonce,
  nonceIsValid,
  openJson,
  proofMatches,
  resolveAtRestKey,
  sealJson,
} from "@/lib/guardian-crypto";

const appKey = resolveAtRestKey(undefined, "x".repeat(40));

describe("guardian crypto", () => {
  it("makes six-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("hashes tokens deterministically without exposing them", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toContain("abc");
  });

  it("round-trips the code at rest and rejects tampering", () => {
    const stored = encryptAtRest("123456", appKey);
    expect(stored).not.toContain("123456");
    expect(decryptAtRest(stored, appKey)).toBe("123456");
    const parts = stored.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptAtRest(parts.join("."), appKey)).toThrow();
  });

  it("accepts the right code's proof and rejects another", async () => {
    const salt = generateSalt();
    const right = await deriveSessionKeys("123456", salt);
    const wrong = await deriveSessionKeys("654321", salt);
    const nonce = issueNonce("share1", appKey);
    expect(proofMatches(right, nonce, expectedProof(right, nonce))).toBe(true);
    expect(proofMatches(right, nonce, expectedProof(wrong, nonce))).toBe(false);
  });

  it("validates nonces: bound to the share, signed, and expiring", () => {
    const now = Date.now();
    const nonce = issueNonce("share1", appKey, now);
    expect(nonceIsValid("share1", nonce, appKey, now + 1000)).toBe(true);
    expect(nonceIsValid("share2", nonce, appKey, now + 1000)).toBe(false);
    expect(nonceIsValid("share1", nonce, appKey, now + 31 * 60 * 1000)).toBe(false);
    expect(nonceIsValid("share1", nonce.slice(0, -2) + "00", appKey, now)).toBe(false);
  });

  it("seals and opens data only with the same keys and nonce", async () => {
    const salt = generateSalt();
    const keys = await deriveSessionKeys("123456", salt);
    const other = await deriveSessionKeys("000000", salt);
    const sealed = sealJson({ glucose: 142 }, keys, "n1");
    expect(openJson(sealed, keys, "n1")).toEqual({ glucose: 142 });
    expect(openJson(sealed, other, "n1")).toBeNull();
    expect(openJson(sealed, keys, "n2")).toBeNull();
  });
});
