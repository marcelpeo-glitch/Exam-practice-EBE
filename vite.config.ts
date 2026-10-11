import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Exams live in /data/exams (JSON + images) and are bundled via import.meta.glob.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node' },
} as never);
