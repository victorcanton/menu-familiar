// functions/_lib/jwt.js
// JWT HS256 (HMAC-SHA256) using WebCrypto (Cloudflare Workers / Pages Functions)

const textEncoder = new TextEncoder();

function base64UrlEncode(bytes) {
  // bytes: ArrayBuffer | Uint8Array
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < u8.length; i++) str += String.fromCharCode(u8[i]);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function jsonToB64Url(obj) {
  const json = JSON.stringify(obj);
  return base64UrlEncode(textEncoder.encode(json));
}

async function importHmacKey(secret) {
  const keyData = textEncoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signHS256(data, secret) {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, textEncoder.encode(data));
  return base64UrlEncode(sig);
}

async function verifyHS256(data, signatureB64Url, secret) {
  const key = await importHmacKey(secret);
  const sigBytes = base64UrlDecodeToBytes(signatureB64Url);
  return crypto.subtle.verify("HMAC", key, sigBytes, textEncoder.encode(data));
}

/**
 * createJWT(payload, secret, options?)
 * options:
 *   - expiresInSec (default 30d)
 *   - issuer, audience
 */
export async function createJWT(payload, secret, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const expiresInSec = options.expiresInSec ?? 30 * 24 * 3600; // 30 dies

  const header = { alg: "HS256", typ: "JWT" };

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSec,
    ...(options.issuer ? { iss: options.issuer } : {}),
    ...(options.audience ? { aud: options.audience } : {}),
  };

  const encodedHeader = jsonToB64Url(header);
  const encodedPayload = jsonToB64Url(fullPayload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await signHS256(signingInput, secret);
  return `${signingInput}.${signature}`;
}

/**
 * verifyJWT(token, secret, options?)
 * returns: { ok:true, payload, header } OR { ok:false, error }
 *
 * options:
 *   - issuer, audience
 *   - clockSkewSec (default 30)
 */
export async function verifyJWT(token, secret, options = {}) {
  try {
    if (!token || typeof token !== "string") {
      return { ok: false, error: "missing_token" };
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return { ok: false, error: "bad_format" };
    }

    const [h, p, s] = parts;
    if (!h || !p || !s) return { ok: false, error: "bad_format" };

    const signingInput = `${h}.${p}`;

    const sigOk = await verifyHS256(signingInput, s, secret);
    if (!sigOk) return { ok: false, error: "bad_signature" };

    const headerJson = new TextDecoder().decode(base64UrlDecodeToBytes(h));
    const payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(p));

    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    // Alg check (defensiu)
    if (header.alg !== "HS256") {
      return { ok: false, error: "unsupported_alg" };
    }

    const now = Math.floor(Date.now() / 1000);
    const skew = options.clockSkewSec ?? 30;

    if (typeof payload.exp === "number" && now > payload.exp + skew) {
      return { ok: false, error: "expired" };
    }
    if (typeof payload.nbf === "number" && now + skew < payload.nbf) {
      return { ok: false, error: "not_before" };
    }

    if (options.issuer && payload.iss !== options.issuer) {
      return { ok: false, error: "bad_issuer" };
    }
    if (options.audience) {
      const aud = payload.aud;
      const ok =
        typeof aud === "string"
          ? aud === options.audience
          : Array.isArray(aud)
          ? aud.includes(options.audience)
          : false;
      if (!ok) return { ok: false, error: "bad_audience" };
    }

    return { ok: true, header, payload };
  } catch (e) {
    return { ok: false, error: "verify_error", detail: String(e) };
  }
}
