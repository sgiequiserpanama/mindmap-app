-- Ejecuta esto en el "SQL Editor" de tu proyecto Supabase (una sola vez)

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

create index if not exists idx_nodos_mapa_id on nodos(mapa_id);

-- Habilita seguridad a nivel de fila
alter table nodos enable row level security;

-- Política simple: cualquiera con la anon key puede leer y escribir.
-- Esto es correcto para un proyecto personal/privado (nadie más conoce tu URL de mapa).
-- Si más adelante agregas login de usuarios, cambia esto para filtrar por auth.uid().
create policy "Acceso publico a nodos"
  on nodos for all
  using (true)
  with check (true);
