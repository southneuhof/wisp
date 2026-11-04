import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: (id) =>
        /^(react|react-dom|@assistant-ui\/react|@assistant-ui\/core|@base-ui\/react|marked)(\/|$)/.test(
          id,
        ) || ['@southneuhof/wisp-core', '@southneuhof/wisp-react'].includes(id),
      output: { banner: "'use client';" },
      onwarn(warning, warn) {
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning)
      },
    },
  },
})
