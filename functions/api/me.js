import { requireAuth, json } from "../_lib/auth";

export async function onRequestGet(ctx) {
  const auth = await requireAuth(ctx);
  if (!auth.ok) return auth.response;

  return json({ ok: true, payload: auth.payload });
}
