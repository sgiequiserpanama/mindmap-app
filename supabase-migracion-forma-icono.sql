-- Ejecuta esto UNA VEZ en el SQL Editor de Supabase
ALTER TABLE nodos ADD COLUMN IF NOT EXISTS forma text;
ALTER TABLE nodos ADD COLUMN IF NOT EXISTS icono text;
ALTER TABLE mapas ADD COLUMN IF NOT EXISTS solo_lectura boolean DEFAULT false;
