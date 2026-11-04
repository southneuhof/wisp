import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/browser',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5198', reducedMotion: 'reduce' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'pnpm exec vite tests/browser --host 127.0.0.1 --port 5198',
    url: 'http://127.0.0.1:5198',
    reuseExistingServer: !process.env.CI,
  },
})
