import { defineConfig } from 'vitest/config'
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup-ui.ts'],
    include: ['tests/react/**/*.test.tsx'],
  },
})
