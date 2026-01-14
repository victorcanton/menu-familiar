import { verifyJWT } from "../_lib/jwt";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
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

async function authenticate(request, env) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;
  
  if (!token) {
    return { ok: false, error: "Missing token" };
  }
  
  if (!env.JWT_SECRET) {
    console.error("JWT_SECRET not configured in environment");
    return { ok: false, error: "Server misconfigured" };
  }
  
  const verification = await verifyJWT(token, env.JWT_SECRET);
  
  if (!verification.ok) {
    return { ok: false, error: verification.error || "Invalid token" };
  }
  
  return { ok: true, family_id: verification.payload.family_id, role: verification.payload.role };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/family - Obtener información de la familia actual
export async function onRequestGet({ request, env }) {
  try {
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured" }, 500);
    }

    const result = await env.DB
      .prepare(`
        SELECT 
          id, name, display_name, role, created_at, updated_at
        FROM families 
        WHERE id = ?1
      `)
      .bind(family_id)
      .first();

    if (!result) {
      return json({ ok: false, error: "Family not found" }, 404);
    }

    // El display_name fallback al name si no está seteado
    const family = {
      ...result,
      display_name: result.display_name || result.name,
    };

    return json({ ok: true, family, role: auth.role });
  } catch (err) {
    console.error("Family GET error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}

// POST /api/family - Actualizar información de la familia
export async function onRequestPost({ request, env }) {
  try {
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;
    const body = await request.json();
    console.log("Family POST body:", body);

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured" }, 500);
    }

    const { display_name, action } = body;

    // Actualizar display_name
    if (action === "updateDisplayName" && display_name !== undefined) {
      const newDisplayName = String(display_name || "").trim();
      
      if (!newDisplayName) {
        return json({ ok: false, error: "Display name cannot be empty" }, 400);
      }

      const now = new Date().toISOString();

      await env.DB
        .prepare(`
          UPDATE families 
          SET display_name = ?1, updated_at = ?2
          WHERE id = ?3
        `)
        .bind(newDisplayName, now, family_id)
        .run();

      return json({ ok: true, display_name: newDisplayName });
    }

    return json({ ok: false, error: "Invalid action" }, 400);
  } catch (err) {
    console.error("Family POST error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}

// PUT /api/family/role - Cambiar role de una familia (solo admin)
export async function onRequestPut({ request, env }) {
  try {
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    // Verificar que es admin
    if (auth.role !== "admin") {
      return json({ ok: false, error: "Unauthorized: admin only" }, 403);
    }

    const body = await request.json();
    const { target_family_id, new_role } = body;

    if (!target_family_id || !new_role) {
      return json({ ok: false, error: "Missing required fields" }, 400);
    }

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured" }, 500);
    }

    const now = new Date().toISOString();

    await env.DB
      .prepare(`
        UPDATE families 
        SET role = ?1, updated_at = ?2
        WHERE id = ?3
      `)
      .bind(new_role, now, target_family_id)
      .run();

    return json({ ok: true });
  } catch (err) {
    console.error("Family PUT error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}
