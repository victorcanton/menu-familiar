import { hashCode } from "../_lib/crypto";
//import { createJWT } from "../_lib/jwt";

export async function onRequestPost({ request, env }) {
  try {
    const { code } = await request.json();
    if (!code || code.length < 4) {
      return json({ ok: false, error: "Invalid code" }, 400);
    }

    const last4 = code.slice(-4);

    // 1️⃣ Buscar candidates pel last4
    const candidates = await env.DB
      .prepare(
        "SELECT id, name, code_hash, code_salt FROM families WHERE code_last4 = ?1"
      )
      .bind(last4)
      .all();

    // 2️⃣ Verificar hash
    let family = null;
    for (const row of candidates.results) {
      const hash = await hashCode(code, row.code_salt);
      if (hash === row.code_hash) {
        family = row;
        break;
      }
    }

    if (!family) {
      return json({ ok: false, error: "Invalid code" }, 401);
    }

    // 3️⃣ JWT
    const token = await createJWT(
      {
        family_id: family.id,
        family_name: family.name
      },
      env.JWT_SECRET
    );

    return json({ ok: true, token });

  } catch (err) {
    return json(
      { ok: false, error: "Server error", detail: String(err) },
      500
    );
  }
}
