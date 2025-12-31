export async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false, status: 401, error: "Missing token" };

  const token = m[1];

  // Verificar JWT HS256 manual (minimalista)
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return { ok: false, status: 401, error: "Bad token" };

  const encoder = new TextEncoder();
  const base64urlToUint8 = (b64url) => {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  };

  const data = `${h}.${p}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigOk = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlToUint8(s),
    encoder.encode(data)
  );

  if (!sigOk) return { ok: false, status: 401, error: "Invalid token" };

  const payloadJson = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
  return { ok: true, payload: payloadJson };
}
