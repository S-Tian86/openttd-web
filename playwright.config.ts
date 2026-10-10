import { defineConfig, devices } from '@playwright/test';

// 4317, not Vite's default 4173: other projects on the same host preview on the defaults.
const PORT = 4317;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // CI uses Playwright's Chromium. Local hosts on Ubuntu 20.04 cannot run it, so they
        // use the installed Google Chrome, which is Chromium-based.
        ...(process.env['CI'] ? {} : { channel: 'chrome' }),
      },
    },
  ],
  // Always the production build: it is what GitHub Pages serves, CSP included.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Never reuse: a stale preview would test an old build and pass falsely.
    reuseExistingServer: false,
  },
});
