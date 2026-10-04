import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  pbkdf2,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * Cryptography for guardian links (see lib/services/guardian-shares.ts).
 *
 * Two separate jobs:
 *
 * 1. **At rest** — the 6-digit code is stored AES-256-GCM encrypted under a
 *    server key, and the URL token only as a SHA-256 hash.
 *
 * 2. **On top of HTTPS** — the guardian's page never sends the code. It
 *    derives two keys from the code with PBKDF2 (salt supplied by the server),
 *    proves it knows the code with an HMAC over a server nonce, and the data
 *    each way is AES-256-GCM encrypted under the other key. The server holds
 *    the code (decrypted from rest) and so derives the same keys. Anyone who
 *    can read the HTTP bodies but not the code — a logging proxy, say — sees
 *    neither the code nor the health values.
 *
 *    Honest limit: a 6-digit code is only ~20 bits, so this does not stop an
 *    attacker who has captured *everything* and can run an offline search; the
 *    online guard (5 wrong codes lock the link, one use, short expiry) is
 *    what stops guessing. The wire format here is mirrored by
 *    components/guardian/guardian-entry.tsx — change both together.
 */

export const PBKDF2_ITERATIONS = 100_000;
export const NONCE_MAX_AGE_MS = 30 * 60 * 1000;

const pbkdf2Async = promisify(pbkdf2);

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Six digits, leading zeros allowed. */
export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateSalt(): string {
  return randomBytes(16).toString("base64");
}

/** The server's at-rest key: SHARE_ENCRYPTION_KEY, or derived from the auth secret. */
export function resolveAtRestKey(shareKey: string | undefined, authSecret: string): Buffer {
  if (shareKey) {
    const raw = Buffer.from(shareKey, "base64");
    if (raw.length !== 32) throw new Error("SHARE_ENCRYPTION_KEY must be base64 of exactly 32 bytes.");
    return raw;
  }
  return Buffer.from(
    hkdfSync("sha256", authSecret, "guardian-share", "at-rest-v1", 32),
  );
}

export function encryptAtRest(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptAtRest(stored: string, key: Buffer): string {
  const [version, iv, tag, ct] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised encrypted value.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export interface SessionKeys {
  aes: Buffer;
  mac: Buffer;
}

/** The keys both ends derive from the code. */
export async function deriveSessionKeys(code: string, saltB64: string): Promise<SessionKeys> {
  const bits = await pbkdf2Async(code, Buffer.from(saltB64, "base64"), PBKDF2_ITERATIONS, 64, "sha256");
  return { aes: bits.subarray(0, 32), mac: bits.subarray(32, 64) };
}

function hmacHex(key: Buffer, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A server-signed, self-expiring nonce the page proves its code against. */
export function issueNonce(shareId: string, appKey: Buffer, now = Date.now()): string {
  const rand = randomBytes(12).toString("hex");
  const body = `${now}.${rand}`;
  return `${body}.${hmacHex(appKey, `${shareId}|${body}`)}`;
}

export function nonceIsValid(shareId: string, nonce: string, appKey: Buffer, now = Date.now()): boolean {
  const [ts, rand, sig] = nonce.split(".");
  if (!ts || !rand || !sig) return false;
  const age = now - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > NONCE_MAX_AGE_MS) return false;
  return safeEqualHex(sig, hmacHex(appKey, `${shareId}|${ts}.${rand}`));
}

export function expectedProof(keys: SessionKeys, nonce: string): string {
  return hmacHex(keys.mac, nonce);
}

export function proofMatches(keys: SessionKeys, nonce: string, proof: string): boolean {
  return safeEqualHex(expectedProof(keys, nonce), proof);
}

/** AES-256-GCM; output is `ciphertext || tag`, base64 — the layout WebCrypto produces. */
export function sealJson(value: unknown, keys: SessionKeys, nonce: string): { iv: string; ct: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys.aes, iv);
  cipher.setAAD(Buffer.from(nonce));
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final(), cipher.getAuthTag()]);
  return { iv: iv.toString("base64"), ct: ct.toString("base64") };
}

/** Returns the parsed JSON, or null when the key, nonce or data do not match. */
export function openJson(payload: { iv: string; ct: string }, keys: SessionKeys, nonce: string): unknown | null {
  try {
    const iv = Buffer.from(payload.iv, "base64");
    const all = Buffer.from(payload.ct, "base64");
    if (iv.length !== 12 || all.length < 17) return null;
    const decipher = createDecipheriv("aes-256-gcm", keys.aes, iv);
    decipher.setAAD(Buffer.from(nonce));
    decipher.setAuthTag(all.subarray(all.length - 16));
    const plain = Buffer.concat([decipher.update(all.subarray(0, all.length - 16)), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    return null;
  }
}
