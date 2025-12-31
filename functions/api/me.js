import { verifyJWT } from "../_lib/jwt";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return json({ ok: false, error: "Missing token" }, 401);

    const token = m[1];
    const payload = await verifyJWT(token, env.JWT_SECRET); // { familyId, ... }

    // Opcional: recuperar nom/id de la família a DB
    const family = await env.DB
      .prepare("SELECT id, name FROM families WHERE id = ?1")
      .bind(payload.familyId)
      .first();

    if (!family) return json({ ok: false, error: "Family not found" }, 401);

    return json({ ok: true, family }, 200);
  } catch (e) {
    return json({ ok: false, error: "Invalid token" }, 401);
  }
}
