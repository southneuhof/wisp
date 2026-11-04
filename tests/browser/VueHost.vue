<script setup lang="ts">
import { shallowRef } from 'vue'
import { WispChat } from '@southneuhof/wisp-vue-ui'
import '@southneuhof/wisp-vue-ui/style.css'
import { createFixture } from './client'
const client = createFixture(
  new URLSearchParams(location.search).has('signedOut'),
)
const state = shallowRef(client.getSnapshot())
client.subscribe((s) => (state.value = s))
const chat = { client, state, url: 'http://os.example' }
</script>
<template><WispChat :chat="chat" /></template>
