<script setup lang="ts">
import { WispChat, useWispChat } from '@southneuhof/wisp-vue-ui'
import '@southneuhof/wisp-vue-ui/style.css'
const chat = useWispChat({
  url: import.meta.env.VITE_CLOUDFLARE_OS_URL || 'http://127.0.0.1:8787',
})
</script>
<template>
  <main style="max-width: 860px; margin: 32px auto; padding: 0 16px">
    <WispChat :chat="chat" />
  </main>
</template>
