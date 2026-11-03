import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: 'react/compiler-runtime',
        replacement: '@assistant-ui/tap/standalone-shim/compiler-runtime',
      },
      { find: /^react$/, replacement: '@assistant-ui/tap/standalone-shim' },
    ],
  },
  test: {
    server: { deps: { inline: [/@assistant-ui/] } },
    setupFiles: ['tests/setup-ui.ts'],
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
