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

// POST /api/family - Actualizar información de la familia o admin actions
export async function onRequestPost({ request, env }) {
  try {
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const body = await request.json();
    console.log("Family POST body:", body);

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured" }, 500);
    }

    const { action, display_name, target_family_id, family_name, family_code, family_role } = body;

    // Actualizar display_name de la familia actual
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
        .bind(newDisplayName, now, auth.family_id)
        .run();

      return json({ ok: true, display_name: newDisplayName });
    }

    // Admin: Obtener lista de todas las familias
    if (action === "listFamilies") {
      if (auth.role !== "admin") {
        return json({ ok: false, error: "Unauthorized: admin only" }, 403);
      }

      const result = await env.DB
        .prepare(`
          SELECT id, name, display_name, code_last4, role, created_at FROM families
          ORDER BY created_at DESC
        `)
        .all();

      return json({ ok: true, families: result.results || [] });
    }

    // Admin: Actualizar display_name de otra familia
    if (action === "updateFamilyDisplayName") {
      if (auth.role !== "admin") {
        return json({ ok: false, error: "Unauthorized: admin only" }, 403);
      }

      if (!target_family_id || !display_name) {
        return json({ ok: false, error: "Missing required fields" }, 400);
      }

      const newDisplayName = String(display_name).trim();
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
        .bind(newDisplayName, now, target_family_id)
        .run();

      return json({ ok: true, display_name: newDisplayName });
    }

    // Admin: Actualizar rol de una familia
    if (action === "updateFamilyRole") {
      if (auth.role !== "admin") {
        return json({ ok: false, error: "Unauthorized: admin only" }, 403);
      }

      if (!target_family_id || !family_role) {
        return json({ ok: false, error: "Missing required fields" }, 400);
      }

      if (!["admin", "member"].includes(family_role)) {
        return json({ ok: false, error: "Invalid role" }, 400);
      }

      const now = new Date().toISOString();

      await env.DB
        .prepare(`
          UPDATE families 
          SET role = ?1, updated_at = ?2
          WHERE id = ?3
        `)
        .bind(family_role, now, target_family_id)
        .run();

      return json({ ok: true });
    }

    return json({ ok: false, error: "Invalid action" }, 400);
  } catch (err) {
    console.error("Family POST error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}

// PUT /api/family/role - DEPRECATED: Use POST with action: "updateFamilyRole" instead
export async function onRequestPut({ request, env }) {
  // Mantener para compatibilidad hacia atrás si es necesario, pero toda la lógica está en POST
  return json({ ok: false, error: "Use POST /api/family with action: updateFamilyRole" }, 400);
}

// DELETE /api/family - Admin: Borrar familia o listar familias para debug
export async function onRequestDelete({ request, env }) {
  try {
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const body = await request.json().catch(() => ({}));

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured" }, 500);
    }

    // Admin: Borrar una familia
    if (body.action === "deleteFamily") {
      if (auth.role !== "admin") {
        return json({ ok: false, error: "Unauthorized: admin only" }, 403);
      }

      const target_family_id = body.target_family_id;
      if (!target_family_id) {
        return json({ ok: false, error: "Missing target_family_id" }, 400);
      }

      // Verificar que existe la familia
      const existing = await env.DB
        .prepare("SELECT id FROM families WHERE id = ?1")
        .bind(target_family_id)
        .first();

      if (!existing) {
        return json({ ok: false, error: "Family not found" }, 404);
      }

      // Borrar la familia
      await env.DB
        .prepare("DELETE FROM families WHERE id = ?1")
        .bind(target_family_id)
        .run();

      return json({ ok: true });
    }

    // Debug: Obtener lista de todas las familias (solo para debug)
    const result = await env.DB
      .prepare(`
        SELECT id, name, code_last4, role, created_at FROM families
      `)
      .all();

    return json({ ok: true, families: result.results || [] });
  } catch (err) {
    console.error("Family DELETE error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}
