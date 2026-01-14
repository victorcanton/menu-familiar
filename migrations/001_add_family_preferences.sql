-- Migración: Agregar campos role y display_name a tabla families
-- Fecha: 2026-01-14

-- Agregar columnas si no existen
ALTER TABLE families ADD COLUMN display_name TEXT;
ALTER TABLE families ADD COLUMN role TEXT DEFAULT 'member';

-- Actualizar la familia CASA-1234 para que sea admin
-- Nota: Reemplaza 'fam_xxx' con el ID real de la familia
UPDATE families SET role = 'admin' WHERE id IN (
  SELECT id FROM families LIMIT 1  -- Cambiar para ser más específico
);

-- Alternativa si conoces el ID específico:
-- UPDATE families SET role = 'admin' WHERE id = 'fam_casa1234';
