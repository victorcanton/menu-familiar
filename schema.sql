-- D1 / SQLite schema for "menu-familiar"

PRAGMA foreign_keys = ON;

-- =========================
-- Families
-- =========================
CREATE TABLE IF NOT EXISTS families (
  id              TEXT PRIMARY KEY,              -- e.g. "fam_9f3a..."
  name            TEXT NOT NULL,                 -- display name
  code_hash       TEXT NOT NULL,                 -- base64 hash (PBKDF2) of family code
  code_salt       TEXT NOT NULL,                 -- base64 salt
  code_last4      TEXT,                          -- for admin UI (non-sensitive hint)
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  code_rotated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_families_name ON families(name);

-- =========================
-- Recipes (catalog)
-- =========================
CREATE TABLE IF NOT EXISTS recipes (
  id           TEXT PRIMARY KEY,                -- e.g. "rec_..."
  family_id    TEXT NOT NULL,
  name         TEXT NOT NULL,
  -- legacy/alternate classification
  meal_type    TEXT,       -- (kept for compatibility)
  -- sheet fields
  category     TEXT,       -- e.g. "Segon", "Plat únic", "Esmorzar"
  icon         TEXT,       -- DEPRECATED: kept for backwards compatibility
  icons        TEXT,       -- JSON array de keys ["soup","salad",...] máx 3
  ingredients  TEXT,
  steps        TEXT,
  video_url    TEXT,
  -- optional derived / UI fields from Sheets
  count        INTEGER DEFAULT 0,
  last_used    TEXT,
  -- earlier flexible fields
  tags_json    TEXT,
  notes        TEXT,                            -- free text
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at  TEXT,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);
-- =========================
-- Menu items (weekly planning)
-- One row = one dish within a date+meal, ordered by position
-- =========================
CREATE TABLE IF NOT EXISTS menu_items (
  id         TEXT PRIMARY KEY,                 -- e.g. "mi_..."
  family_id  TEXT NOT NULL,
  date       TEXT NOT NULL,                    -- "YYYY-MM-DD"
  meal       TEXT NOT NULL,                    -- "breakfast" | "lunch" | "snack" | "dinner"
  position   INTEGER NOT NULL DEFAULT 1,        -- ordering within the meal
  recipe_id  TEXT,                             -- optional link to recipes
  label      TEXT,                             -- fallback free-text if no recipe_id (or for ad-hoc items)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
);

-- Ensure deterministic ordering and easy upserts
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_item_slot
  ON menu_items(family_id, date, meal, position);

CREATE INDEX IF NOT EXISTS idx_menu_items_family_date
  ON menu_items(family_id, date);

-- =========================
-- Notes per cell (optional, but handy)
-- e.g. notes for "lunch" on a given date, regardless of dishes
-- =========================
CREATE TABLE IF NOT EXISTS cell_notes (
  id         TEXT PRIMARY KEY,                 -- e.g. "cn_..."
  family_id  TEXT NOT NULL,
  date       TEXT NOT NULL,                    -- "YYYY-MM-DD"
  meal       TEXT NOT NULL,                    -- same as menu_items.meal
  note       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cell_notes
  ON cell_notes(family_id, date, meal);

-- =========================
-- (Optional) Admin audit log (recommended)
-- =========================
CREATE TABLE IF NOT EXISTS admin_audit (
  id         TEXT PRIMARY KEY,                 -- e.g. "aa_..."
  action     TEXT NOT NULL,                    -- "family_create" | "family_rotate_code" | ...
  meta_json  TEXT,                             -- JSON blob
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
