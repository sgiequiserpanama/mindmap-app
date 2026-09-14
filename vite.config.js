import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Este archivo configura Vite para compilar la app React del mapa mental y habilitar el plugin oficial de React.
export default defineConfig({
  plugins: [react()],
});
