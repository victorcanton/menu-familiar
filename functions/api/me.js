// functions/api/me.js
import { verifyJWT } from "../_lib/jwt";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function getBearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export async function onRequestGet({ request, env }) {
  try {
    const token = getBearerToken(request);
    if (!token) return json({ ok: false, error: "Missing token" }, 401);

    const v = await verifyJWT(token, env.JWT_SECRET);
    if (!v.ok) return json({ ok: false, error: v.error }, 401);

    return json({ ok: true, payload: v.payload });
  } catch (e) {
    return json({ ok: false, error: "Server error", detail: String(e) }, 500);
  }
}
