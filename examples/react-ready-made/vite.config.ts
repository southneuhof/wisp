import { defineConfig } from 'vite'
export default defineConfig({
  cacheDir: new URL(
    '../../node_modules/.vite/wisp-react-example',
    import.meta.url,
  ).pathname,
  esbuild: { jsx: 'automatic' },
})
