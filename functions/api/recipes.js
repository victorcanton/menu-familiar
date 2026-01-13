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

function generateId(prefix) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = prefix + "_";
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/**
 * Valida y normaliza el array de iconos
 * @param {string|array} icons - JSON string o array
 * @returns {string|null} - JSON string si válido, null si vacío o inválido
 */
function validateAndNormalizeIcons(icons) {
  if (!icons) return null;

  let iconArray = icons;

  // Si es string, intentar parsear como JSON
  if (typeof icons === "string") {
    if (!icons.trim()) return null;
    try {
      iconArray = JSON.parse(icons);
    } catch (e) {
      // Si falla, asumir que es un string single (backwards compatibility)
      iconArray = [icons.trim()];
    }
  }

  // Asegurar que es array
  if (!Array.isArray(iconArray)) {
    iconArray = [String(iconArray)];
  }

  // Filtrar vacíos, limitar a 3, y convertir a strings
  iconArray = iconArray
    .map(i => String(i).trim())
    .filter(i => i.length > 0)
    .slice(0, 3); // Máximo 3 iconos

  // Si quedó vacío, retornar null
  if (iconArray.length === 0) return null;

  // Retornar como JSON string
  return JSON.stringify(iconArray);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
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
  
  return { ok: true, family_id: verification.payload.family_id };
}

export async function onRequestGet({ request, env }) {
  try {
    console.log("GET /api/recipes - Starting");
    
    const auth = await authenticate(request, env);
    console.log("Auth result:", auth);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;
    console.log("Family ID:", family_id);
    console.log("env.DB:", env.DB ? "exists" : "MISSING");

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured" }, 500);
    }

    const result = await env.DB
      .prepare(`
        SELECT 
          id, name, category, icon, icons, ingredients, steps, video_url, created_at 
        FROM recipes 
        WHERE family_id = ?1 
        ORDER BY name
      `)
      .bind(family_id)
      .all();

    console.log("Query result:", result);

    const recipes = (result.results || []).map(r => ({
      ...r,
      // Para compatibilidad: si no hay icons pero sí icon, usar icon
      icons: r.icons || (r.icon ? JSON.stringify([r.icon]) : null),
    }));
    
    // Count usage of each recipe in current menu
    const countResult = await env.DB
      .prepare(`
        SELECT recipe_id, COUNT(*) as cnt 
        FROM menu_items 
        WHERE family_id = ?1 AND recipe_id IS NOT NULL
        GROUP BY recipe_id
      `)
      .bind(family_id)
      .all();

    const counts = {};
    (countResult.results || []).forEach(row => {
      counts[row.recipe_id] = row.cnt;
    });

    const recipesWithCount = recipes.map(r => ({
      ...r,
      count: counts[r.id] || 0,
    }));

    return json({ ok: true, recipes: recipesWithCount });
  } catch (err) {
    console.error("Recipe GET error:", err);
    return json({ ok: false, error: "Server error", detail: String(err), stack: err.stack }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    console.log("POST /api/recipes - Starting");
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;
    const body = await request.json();
    console.log("POST body:", body);
    
    const { id, name, category, icon, icons, ingredients, steps, video_url } = body;

    if (!name || !name.trim()) {
      return json({ ok: false, error: "Name is required" }, 400);
    }

    // Validar y normalizar iconos
    // Prioridad: icons (nuevo) > icon (antiguo)
    let iconsToStore = validateAndNormalizeIcons(icons || icon);
    console.log("Icons to store:", iconsToStore);

    const now = new Date().toISOString();

    if (id) {
      // Update existing recipe
      console.log("Updating recipe:", id);
      await env.DB
        .prepare(`
          UPDATE recipes 
          SET name = ?1, category = ?2, icons = ?3, ingredients = ?4, steps = ?5, video_url = ?6, updated_at = ?7
          WHERE id = ?8 AND family_id = ?9
        `)
        .bind(
          name.trim(),
          category || null,
          iconsToStore,
          ingredients || null,
          steps || null,
          video_url || null,
          now,
          id,
          family_id
        )
        .run();

      console.log("Recipe updated successfully");
      return json({ ok: true, id });
    } else {
      // Create new recipe
      const newId = generateId("rec");
      console.log("Creating new recipe:", newId);
      
      await env.DB
        .prepare(`
          INSERT INTO recipes (id, family_id, name, category, icons, ingredients, steps, video_url, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        `)
        .bind(
          newId,
          family_id,
          name.trim(),
          category || null,
          iconsToStore,
          ingredients || null,
          steps || null,
          video_url || null,
          now,
          now
        )
        .run();

      console.log("Recipe created successfully");
      return json({ ok: true, id: newId });
    }
  } catch (err) {
    console.error("Recipe POST error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  // PUT es alias de POST para actualizar
  return onRequestPost({ request, env });
}

export async function onRequestDelete({ request, env }) {
  try {
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({ ok: false, error: "Recipe ID required" }, 400);
    }

    await env.DB
      .prepare("DELETE FROM recipes WHERE id = ?1 AND family_id = ?2")
      .bind(id, family_id)
      .run();

    return json({ ok: true });
  } catch (err) {
    console.error("Recipe DELETE error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}