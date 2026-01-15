// functions/_lib/auth.js
import { verifyJWT } from "./jwt";

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function getBearerToken(request) {
  const h = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * requireAuth({ request, env }) -> { ok:true, payload } | { ok:false, response }
 */
export async function requireAuth({ request, env }) {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, response: json({ ok: false, error: "missing_token" }, 401) };
  }

  const v = await verifyJWT(token, env.JWT_SECRET);
  if (!v.ok) {
    return { ok: false, response: json({ ok: false, error: v.error }, 401) };
  }

  return { ok: true, payload: v.payload };
}
