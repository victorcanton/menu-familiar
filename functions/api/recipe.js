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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function authenticate(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;
  
  if (!token) {
    return { ok: false, error: "Missing token" };
  }
  
  // Note: You'll need to add verifyJWT to your jwt.js
  // For now, assuming it returns { ok: true, payload: { family_id, family_name } }
  const verification = { ok: true, payload: { family_id: "fam_test" } }; // Placeholder
  
  if (!verification.ok) {
    return { ok: false, error: "Invalid token" };
  }
  
  return { ok: true, family_id: verification.payload.family_id };
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await authenticate(request);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;

    const result = await env.DB
      .prepare("SELECT id, name, category, icon, ingredients, steps, video_url, created_at FROM recipes WHERE family_id = ?1 ORDER BY name")
      .bind(family_id)
      .all();

    const recipes = result.results || [];
    
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
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const auth = await authenticate(request);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;
    const body = await request.json();
    const { id, name, category, icon, ingredients, steps, video_url } = body;

    if (!name || !name.trim()) {
      return json({ ok: false, error: "Name is required" }, 400);
    }

    const now = new Date().toISOString();

    if (id) {
      // Update existing recipe
      await env.DB
        .prepare(`
          UPDATE recipes 
          SET name = ?1, category = ?2, icon = ?3, ingredients = ?4, steps = ?5, video_url = ?6, updated_at = ?7
          WHERE id = ?8 AND family_id = ?9
        `)
        .bind(name.trim(), category || null, icon || null, ingredients || null, steps || null, video_url || null, now, id, family_id)
        .run();

      return json({ ok: true, id });
    } else {
      // Create new recipe
      const newId = generateId("rec");
      await env.DB
        .prepare(`
          INSERT INTO recipes (id, family_id, name, category, icon, ingredients, steps, video_url, created_at, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        `)
        .bind(newId, family_id, name.trim(), category || null, icon || null, ingredients || null, steps || null, video_url || null, now, now)
        .run();

      return json({ ok: true, id: newId });
    }
  } catch (err) {
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const auth = await authenticate(request);
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
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}