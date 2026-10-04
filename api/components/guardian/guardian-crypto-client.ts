/**
 * Browser half of the guardian-link protocol — the mirror of
 * lib/guardian-crypto.ts. The code never leaves the browser: it is stretched
 * with PBKDF2 into an AES key and an HMAC key, the page proves it knows the
 * code with an HMAC over the server's nonce, and the data each way is
 * AES-256-GCM encrypted (nonce as additional data).
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin);
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface SessionKeys {
  aes: CryptoKey;
  mac: CryptoKey;
}

export async function deriveSessionKeys(code: string, saltB64: string, iterations: number): Promise<SessionKeys> {
  const base = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations },
      base,
      512,
    ),
  );
  const aes = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  const mac = await crypto.subtle.importKey("raw", bits.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return { aes, mac };
}

export async function proofFor(keys: SessionKeys, nonce: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", keys.mac, enc.encode(nonce)));
}

export async function sealJson(value: unknown, keys: SessionKeys, nonce: string): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(nonce) },
    keys.aes,
    enc.encode(JSON.stringify(value)),
  );
  return { iv: toB64(iv), ct: toB64(ct) };
}

export async function openJson<T>(payload: { iv: string; ct: string }, keys: SessionKeys, nonce: string): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(payload.iv), additionalData: enc.encode(nonce) },
    keys.aes,
    fromB64(payload.ct),
  );
  return JSON.parse(dec.decode(plain)) as T;
}
