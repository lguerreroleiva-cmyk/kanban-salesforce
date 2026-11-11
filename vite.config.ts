/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** `npm run demo`: reemplaza el cliente Supabase por uno en memoria con datos de ejemplo. */
function demoSupabase(): Plugin {
  const fake = resolve(__dirname, 'src/demo/fakeSupabase.ts');
  return {
    name: 'demo-supabase',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || importer.includes('/src/demo/')) return null;
      if (/(^|\/)lib\/supabase$/.test(source) || (source === './supabase' && importer.includes('/src/lib/'))) return fake;
      return null;
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [demoSupabase()] : [])],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [['tests/db/**', 'node']],
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/db/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
}));
