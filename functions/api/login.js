export async function onRequestPost({ request, env }) {
  const { code } = await request.json();

  if (!code || code.length < 4) {
    return json({ error: "Invalid code" }, 400);
  }

  // Últims 4 dígits per lookup ràpid
  const last4 = code.slice(-4);

  const fam = await env.DB
    .prepare(`
      SELECT id, code_hash, code_salt
      FROM families
      WHERE code_last4 = ?
      LIMIT 1
    `)
    .bind(last4)
    .first();

  if (!fam) {
    return json({ error: "Family not found" }, 401);
  }

  const valid = await verifyCode(code, fam.code_salt, fam.code_hash);
  if (!valid) {
    return json({ error: "Invalid code" }, 401);
  }

  const token = await signJWT(
    { family_id: fam.id },
    env.JWT_SECRET,
    60 * 60 * 24 * 30 // 30 dies
  );

  return json({ token });
}

/* helpers */

async function verifyCode(code, salt, expectedHash) {
  const enc = new TextEncoder();
  const data = enc.encode(code + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === expectedHash;
}

async function signJWT(payload, secret, expSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expSeconds;

  const enc = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const body = enc({ ...payload, exp });
  const head = enc(header);
  const msg = `${head}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(msg)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${msg}.${sigB64}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
