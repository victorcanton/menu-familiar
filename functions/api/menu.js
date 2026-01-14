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

// Helper: convert position to course name
function positionToCourse(meal, position) {
  if (meal === "lunch" || meal === "dinner") {
    if (position === 1) return "primer";
    if (position === 2) return "segon";
    if (position === 3) return "unic";
  }
  return "plat";
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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ request, env }) {
  try {
    console.log("GET /api/menu - Starting");
    
    const auth = await authenticate(request, env);
    console.log("Auth result:", auth);
    if (!auth.ok) return json({ ok: false, error: auth.error }, 401);

    const family_id = auth.family_id;
    const url = new URL(request.url);
    const weekStart = url.searchParams.get("weekStart");
    const weekEnd = url.searchParams.get("weekEnd");

    console.log("Params - weekStart:", weekStart, "weekEnd:", weekEnd);
    console.log("env.DB:", env.DB ? "exists" : "MISSING");

    if (!weekStart || !weekEnd) {
      return json({ ok: false, error: "weekStart and weekEnd required" }, 400);
    }

    if (!env.DB) {
      return json({ ok: false, error: "Database not configured" }, 500);
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

    console.log("Menu items result:", itemsResult);

    // Transform results to include slot_id
    const plan = (itemsResult.results || []).map(item => ({
      slot_id: `${item.date}_${item.meal}_${positionToCourse(item.meal, item.position)}`,
      id: item.id,
      date: item.date,
      meal: item.meal,
      position: item.position,
      recipe_id: item.recipe_id,
      label: item.label
    }));

    // Get notes for the week
    const notesResult = await env.DB
      .prepare(`
        SELECT id, date, meal, note
        FROM cell_notes
        WHERE family_id = ?1 AND date >= ?2 AND date <= ?3
      `)
      .bind(family_id, weekStart, weekEnd)
      .all();

    console.log("Notes result:", notesResult);

    return json({
      ok: true,
      plan: plan,
      notes: notesResult.results || [],
    });
  } catch (err) {
    console.error("Menu GET error:", err);
    return json({ ok: false, error: "Server error", detail: String(err), stack: err.stack }, 500);
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
      console.log("applyChanges: received changes", JSON.stringify(changes));
      for (const change of changes || []) {
        console.log("Processing change:", JSON.stringify(change));
        if (change.__delete) {
          // Delete the menu item
          // Parse slot_id (format: "YYYY-MM-DD_meal_course") to extract date, meal, course
          const parts = (change.slot_id || "").split("_");
          if (parts.length >= 3) {
            const deleteDate = parts[0];  // "2026-01-06"
            const deleteMeal = parts[1];  // "lunch"
            const deleteCourse = parts[2]; // "primer", "segon", "unic", or "plat"
            
            // Map course name back to position
            const courseToPosition = {
              "primer": 1,
              "segon": 2,
              "unic": 3,
              "plat": 1,
            };
            const deletePos = courseToPosition[deleteCourse] || 1;
            
            // Delete by date, meal, and position (these are the unique identifiers)
            await env.DB
              .prepare("DELETE FROM menu_items WHERE family_id = ?1 AND date = ?2 AND meal = ?3 AND position = ?4")
              .bind(family_id, deleteDate, deleteMeal, deletePos)
              .run();
            
            console.log(`Deleted: ${deleteDate} ${deleteMeal} position ${deletePos}`);
          }
        } else {
          // Parse meal string (e.g., "lunch_primer" -> meal: "lunch", position: 1)
          const mealParts = (change.meal || "").split("_");
          const mealKey = mealParts[0];
          
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
            .prepare("SELECT id, recipe_id FROM menu_items WHERE family_id = ?1 AND date = ?2 AND meal = ?3 AND position = ?4")
            .bind(family_id, change.date, mealKey, pos)
            .first();
          
          console.log(`Looking for menu_item: family=${family_id}, date=${change.date}, meal=${mealKey}, pos=${pos}`);
          console.log(`Existing menu_item: ${JSON.stringify(existing)}`);

          if (existing) {
            // If recipe_id is changing and it's a new recipe, increment its count
            console.log(`Existing recipe_id: ${existing.recipe_id}, new recipe_id: ${change.recipe_id}`);
            if (change.recipe_id && change.recipe_id !== existing.recipe_id) {
              console.log(`Incrementing count for recipe ${change.recipe_id}`);
              const updateResult = await env.DB
                .prepare("UPDATE recipes SET count = count + 1 WHERE id = ?1 AND family_id = ?2")
                .bind(change.recipe_id, family_id)
                .run();
              console.log(`Update result: ${JSON.stringify(updateResult)}`);
            }
            
            await env.DB
              .prepare("UPDATE menu_items SET recipe_id = ?1, label = ?2, updated_at = ?3 WHERE id = ?4 AND family_id = ?5")
              .bind(change.recipe_id || null, change.label || null, now, existing.id, family_id)
              .run();
          } else if (change.recipe_id) {
            // Incrementar contador al crear nuevo item
            console.log(`Creating new menu_item and incrementing count for recipe ${change.recipe_id}`);
            
            const itemId = generateId("mi");
            await env.DB
              .prepare("INSERT INTO menu_items (id, family_id, date, meal, position, recipe_id, label, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)")
              .bind(itemId, family_id, change.date, mealKey, pos, change.recipe_id, change.label || null, now, now)
              .run();
            
            const updateResult = await env.DB
              .prepare("UPDATE recipes SET count = count + 1 WHERE id = ?1 AND family_id = ?2")
              .bind(change.recipe_id, family_id)
              .run();
            console.log(`Update count result: ${JSON.stringify(updateResult)}`);
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