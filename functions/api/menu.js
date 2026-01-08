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

async function authenticate(request, env) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;
  
  if (!token) {
    return { ok: false, error: "Missing token" };
  }
  
  const verification = await verifyJWT(token, env.JWT_SECRET);
  
  if (!verification.ok) {
    return { ok: false, error: verification.error || "Invalid token" };
  }
  
  return { ok: true, family_id: verification.payload.family_id };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ request, env }) {
  try {
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;
    const url = new URL(request.url);
    const weekStart = url.searchParams.get("weekStart");
    const weekEnd = url.searchParams.get("weekEnd");

    if (!weekStart || !weekEnd) {
      return json({ ok: false, error: "weekStart and weekEnd required" }, 400);
    }

    // Get menu items for the week
    const itemsResult = await env.DB
      .prepare(`
        SELECT id, date, meal, position, recipe_id, label
        FROM menu_items
        WHERE family_id = ?1 AND date >= ?2 AND date <= ?3
        ORDER BY date, meal, position
      `)
      .bind(family_id, weekStart, weekEnd)
      .all();

    // Get notes for the week
    const notesResult = await env.DB
      .prepare(`
        SELECT id, date, meal, note
        FROM cell_notes
        WHERE family_id = ?1 AND date >= ?2 AND date <= ?3
      `)
      .bind(family_id, weekStart, weekEnd)
      .all();

    return json({
      ok: true,
      plan: itemsResult.results || [],
      notes: notesResult.results || [],
    });
  } catch (err) {
    console.error("Menu GET error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const auth = await authenticate(request, env);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;
    const body = await request.json();
    const { action, date, meal, position, recipe_id, label, note, changes } = body;

    const now = new Date().toISOString();

    if (action === "setNote") {
      // Set or delete note for a meal slot
      if (note && note.trim()) {
        // Check if note exists
        const existing = await env.DB
          .prepare("SELECT id FROM cell_notes WHERE family_id = ?1 AND date = ?2 AND meal = ?3")
          .bind(family_id, date, meal)
          .first();

        if (existing) {
          await env.DB
            .prepare("UPDATE cell_notes SET note = ?1, updated_at = ?2 WHERE family_id = ?3 AND date = ?4 AND meal = ?5")
            .bind(note.trim(), now, family_id, date, meal)
            .run();
        } else {
          const noteId = generateId("cn");
          await env.DB
            .prepare("INSERT INTO cell_notes (id, family_id, date, meal, note, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
            .bind(noteId, family_id, date, meal, note.trim(), now, now)
            .run();
        }
      } else {
        // Delete note if empty
        await env.DB
          .prepare("DELETE FROM cell_notes WHERE family_id = ?1 AND date = ?2 AND meal = ?3")
          .bind(family_id, date, meal)
          .run();
      }

      return json({ ok: true });
    } else if (action === "applyChanges") {
      // Apply multiple slot changes
      for (const change of changes || []) {
        if (change.__delete) {
          // Delete the menu item
          await env.DB
            .prepare("DELETE FROM menu_items WHERE family_id = ?1 AND id = ?2")
            .bind(family_id, change.slot_id)
            .run();
        } else {
          // Parse meal string (e.g., "lunch_primer" -> meal: "lunch", position: 1)
          const mealParts = (change.meal || "").split("_");
          const mealKey = mealParts[0];
          const courseIndex = mealParts[1] ? parseInt(mealParts[1]) : 1;
          
          // Map course names to positions
          const courseToPosition = {
            "primer": 1,
            "segon": 2,
            "unic": 3,
            "plat": 1,
          };
          const pos = courseToPosition[mealParts[1]] || 1;

          // Check if menu item exists
          const existing = await env.DB
            .prepare("SELECT id FROM menu_items WHERE family_id = ?1 AND date = ?2 AND meal = ?3 AND position = ?4")
            .bind(family_id, change.date, mealKey, pos)
            .first();

          if (existing) {
            await env.DB
              .prepare("UPDATE menu_items SET recipe_id = ?1, label = ?2, updated_at = ?3 WHERE id = ?4 AND family_id = ?5")
              .bind(change.recipe_id || null, change.label || null, now, existing.id, family_id)
              .run();
          } else if (change.recipe_id) {
            const itemId = generateId("mi");
            await env.DB
              .prepare("INSERT INTO menu_items (id, family_id, date, meal, position, recipe_id, label, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
              .bind(itemId, family_id, change.date, mealKey, pos, change.recipe_id, change.label || null, now, now)
              .run();
          }
        }
      }

      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Menu POST error:", err);
    return json({ ok: false, error: "Server error", detail: String(err) }, 500);
  }
}