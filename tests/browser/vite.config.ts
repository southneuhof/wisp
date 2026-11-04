import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  cacheDir: new URL('../../node_modules/.vite/wisp-parity', import.meta.url)
    .pathname,
  plugins: [vue()],
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 5198 },
})
