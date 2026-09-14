import { createClient } from '@supabase/supabase-js';

// Este archivo crea el cliente de Supabase para leer y escribir nodos, mapas e imágenes del proyecto.
// Las variables de entorno deben estar definidas en el archivo .env del proyecto.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan las variables VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env'
  );
}

// supabase: instancia global usada por el resto de la app para guardar mapas y nodos en la nube.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
