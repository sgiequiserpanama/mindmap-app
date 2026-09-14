-- Este script aplica la migración para soportar ancho configurable, forma visual e icono en cada nodo.
-- También habilita la columna de solo lectura en los mapas para controlar acceso desde la base de datos.
ALTER TABLE nodos ADD COLUMN IF NOT EXISTS ancho float DEFAULT 260;
ALTER TABLE nodos ADD COLUMN IF NOT EXISTS forma text;
ALTER TABLE nodos ADD COLUMN IF NOT EXISTS icono text;
ALTER TABLE mapas ADD COLUMN IF NOT EXISTS solo_lectura boolean DEFAULT false;
