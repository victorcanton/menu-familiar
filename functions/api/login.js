// functions/api/login.js

function json(data, status = 200, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

function b64url(bytes) {
  let str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSHA256(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
}

async function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const h = enc(header);
  const p = enc(payload);
  const toSign = `${h}.${p}`;
  const sig = await hmacSHA256(secret, toSign);
  return `${toSign}.${b64url(sig)}`;
}

// Preflight CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const code = String(body?.code || "").trim();

    if (!code) return json({ ok: false, error: "Missing code" }, 400);
    if (!env.JWT_SECRET) return json({ ok: false, error: "Missing JWT_SECRET" }, 500);
    if (!env.DB) return json({ ok: false, error: "Missing DB binding" }, 500);

    // IMPORTANT:
    // Ajusta el nom de la columna del codi segons el teu esquema real.
    // Opció A (recomanada): families.family_code
    // Opció B: families.rota_code (si és el que tens)
    const row =
      (await env.DB
        .prepare("SELECT id, name FROM families WHERE family_code = ?1")
        .bind(code)
        .first())
      || (await env.DB
        .prepare("SELECT id, name FROM families WHERE rota_code = ?1")
        .bind(code)
        .first());

    if (!row) return json({ ok: false, error: "Invalid code" }, 401);

    const now = Math.floor(Date.now() / 1000);
    const token = await signJWT(
      {
        sub: row.id,
        fam: row.id,
        name: row.name,
        iat: now,
        exp: now + 60 * 60 * 24 * 30, // 30 dies
      },
      env.JWT_SECRET
    );

    return json({ ok: true, token, family: { id: row.id, name: row.name } });
  } catch (e) {
    return json({ ok: false, error: "Server error", detail: String(e?.message || e) }, 500);
  }
}

