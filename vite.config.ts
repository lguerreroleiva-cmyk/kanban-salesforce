/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [['tests/db/**', 'node']],
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/db/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
