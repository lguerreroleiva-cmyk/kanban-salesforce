import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra la app + Supabase local (`supabase start` y `npm run dev`).
 * Variables: E2E_EMAIL / E2E_PASSWORD de un usuario de prueba creado en el stack local.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
});
