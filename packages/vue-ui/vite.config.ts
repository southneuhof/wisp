import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { thirdPartyNotices } from './build/third-party-notices.js'
export default defineConfig({
  plugins: [vue(), thirdPartyNotices()],
  resolve: {
    alias: [
      {
        find: 'react/compiler-runtime',
        replacement: '@assistant-ui/tap/standalone-shim/compiler-runtime',
      },
      { find: /^react$/, replacement: '@assistant-ui/tap/standalone-shim' },
    ],
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['vue', '@southneuhof/wisp-core', '@southneuhof/wisp-vue'],
    },
  },
})
