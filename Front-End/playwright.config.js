import { defineConfig } from '@playwright/test'

// `npm run test:e2e` recreates the throwaway *_test database first, then this
// config boots the real backend (against it, with market data stubbed) and the
// real Vite dev server (on dedicated ports 5100/5174 so it never collides
// with a running dev environment), and drives Chromium against them.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node tests/helpers/e2eServer.js',
      cwd: '../Back-End',
      env: { E2E_BACKEND_PORT: '5100', FRONTEND_URL: 'http://localhost:5174' },
      url: 'http://localhost:5100/api/health',
      // E2E_REUSE_BACKEND lets a run attach to an already-started backend (used to capture its log).
      reuseExistingServer: Boolean(process.env.E2E_REUSE_BACKEND),
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      env: { VITE_API_BASE_URL: 'http://localhost:5100' },
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
