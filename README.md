# Mapa Mental Ilimitado

App propia de mapas mentales (nodos + sub-nodos + hipervínculos), sin límite de nodos, con guardado en la nube (Supabase) y lista para compartir en línea.

## 1. Instalar dependencias

Abre esta carpeta en VS Code, abre una terminal integrada y corre:

```bash
npm install
```

## 2. Crear tu proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta gratis.
2. Crea un nuevo proyecto (elige una contraseña de base de datos, guárdala).
3. Una vez creado, ve a **SQL Editor** (menú lateral) y pega el contenido del archivo
   `supabase-setup.sql` de esta carpeta. Dale "Run".
4. Ve a **Project Settings → API**. Copia:
   - **Project URL**
   - **anon public key**

## 3. Configurar tus variables de entorno

1. Copia `.env.example` y renómbralo a `.env`.
2. Pega ahí tu URL y tu anon key:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-publica
```

## 4. Correr localmente

```bash
npm run dev
```

Abre la URL que te muestre (normalmente `http://localhost:5173`).

## 5. Cómo usarlo

- Al abrir por primera vez se crea un nodo raíz "Tema central" y un `?mapa=xxxxx` se añade a la URL — **ese enlace es tu mapa**, guárdalo o compártelo.
- **Doble clic** sobre el texto de un nodo → editarlo.
- Botón **+** → agrega un sub-nodo.
- Botón **⚙** → agrega o edita el hipervínculo del nodo.
- Botón **×** → elimina el nodo (y sus sub-nodos).
- Arrastra los nodos para reordenar; la posición se guarda sola.
- Botón "Compartir mapa" (arriba a la derecha) → copia el enlace de este mapa específico al portapapeles.

No hay límite de nodos: la única restricción es el espacio de tu base de datos en Supabase (500 MB gratis, equivalente a cientos de miles de nodos de texto).

## 6. Publicarlo en línea (Vercel)

1. Sube esta carpeta a un repositorio de GitHub (puede ser privado).
2. Ve a https://vercel.com, inicia sesión con GitHub, "Add New Project" y selecciona el repo.
3. En "Environment Variables" agrega las mismas dos variables que pusiste en tu `.env`
   (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
4. Dale "Deploy". Te dará una URL pública tipo `tu-app.vercel.app`.
5. Cualquiera con el enlace `tu-app.vercel.app/?mapa=xxxxx` puede ver y editar ese mapa
   (no hay login todavía — cualquiera con el enlace exacto de un mapa puede editarlo,
   pero nadie puede adivinar el id al azar).

## Nota sobre seguridad

Este proyecto usa una política de Supabase abierta (cualquiera con tu `anon key` puede
leer/escribir la tabla `nodos`). Es razonable para uso personal, pero si quieres proteger
mapas individuales con contraseña o cuentas de usuario, el siguiente paso sería activar
Supabase Auth y ajustar la política en `supabase-setup.sql` para filtrar por `auth.uid()`.
Puedes pedírmelo cuando quieras dar ese paso.
