import { hashCode } from "../_lib/crypto";
import { createJWT } from "../_lib/jwt";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  try {
    const { code } = await request.json();
    if (!code || code.length < 4) {
      return json({ ok: false, error: "Invalid code" }, 400);
    }

    const last4 = code.slice(-4);

    const candidates = await env.DB
      .prepare("SELECT id, name, code_hash, code_salt FROM families WHERE code_last4 = ?1")
      .bind(last4)
      .all();

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

    // ... quan tens family valida:
    const token = await createJWT(
      { family_id: family.id, family_name: family.name },
      env.JWT_SECRET,
      { expiresInSec: 60 * 60 * 24 * 30 }
    );
    

    return json({ ok: true, token, family: { id: family.id, name: family.name } });
  } catch (err) {
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}
