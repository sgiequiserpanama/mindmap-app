-- Este script crea la estructura base de datos para guardar los nodos y la relación jerárquica del mapa mental en Supabase.
-- Debe ejecutarse una sola vez desde el SQL Editor del proyecto de Supabase.

create table if not exists nodos (
  id text primary key,
  mapa_id text not null,
  texto text not null default 'Nuevo nodo',
  hipervinculo text,
  padre_id text references nodos(id) on delete cascade,
  posicion_x float not null default 0,
  posicion_y float not null default 0,
  ancho float not null default 260,
  created_at timestamp with time zone default now()
);

-- idx_nodos_mapa_id: acelera las consultas por mapa para cargar el árbol y localizar los nodos asociados rápidamente.
create index if not exists idx_nodos_mapa_id on nodos(mapa_id);

-- Habilita la seguridad a nivel de fila para que la tabla pueda aplicar políticas de acceso por request.
alter table nodos enable row level security;

-- Política simple: cualquiera con la anon key puede leer y escribir.
-- Esto es correcto para un proyecto personal/privado (nadie más conoce tu URL de mapa).
-- Si más adelante agregas login de usuarios, cambia esto para filtrar por auth.uid().
create policy "Acceso publico a nodos"
  on nodos for all
  using (true)
  with check (true);
