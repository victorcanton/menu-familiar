// functions/_lib/jwt.js

function b64urlEncode(bytes) {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecodeToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function jsonToB64url(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return b64urlEncode(bytes);
}

function b64urlToJson(b64url) {
  const bytes = b64urlDecodeToBytes(b64url);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

async function importHmacKey(secret) {
  const keyBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signHS256(data, secret) {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

async function verifyHS256(data, signatureB64url, secret) {
  const key = await importHmacKey(secret);
  const sigBytes = b64urlDecodeToBytes(signatureB64url);
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
}

export async function createJWT(payload, secret, { expiresInSec = 60 * 60 * 24 * 30 } = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSec,
  };

  const h = jsonToB64url(header);
  const p = jsonToB64url(fullPayload);
  const data = `${h}.${p}`;
  const s = await signHS256(data, secret);

  return `${data}.${s}`;
}

export async function verifyJWT(token, secret) {
  if (!token || typeof token !== "string") return { ok: false, error: "Missing token" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "Bad token format" };

  const [h, p, s] = parts;

  let header, payload;
  try {
    header = b64urlToJson(h);
    payload = b64urlToJson(p);
  } catch {
    return { ok: false, error: "Bad token encoding" };
  }

  if (header?.alg !== "HS256") return { ok: false, error: "Unsupported alg" };

  const data = `${h}.${p}`;
  const validSig = await verifyHS256(data, s, secret);
  if (!validSig) return { ok: false, error: "Bad signature" };

  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && now >= payload.exp) return { ok: false, error: "Token expired" };

  return { ok: true, payload };
}
