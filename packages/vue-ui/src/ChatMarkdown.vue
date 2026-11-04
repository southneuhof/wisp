<script setup lang="ts">
import { computed } from 'vue'
import { useAuiState } from '@assistant-ui/vue'
import { renderSafeMarkdown } from './markdown'

const text = useAuiState((state) =>
  state.part.type === 'text' ? state.part.text : '',
)
const html = computed(() => renderSafeMarkdown(text.value))
</script>

<template>
  <div
    class="wisp-markdown wisp-min-w-0 wisp-max-w-full wisp-break-words"
    v-html="html"
  />
</template>
