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

<style scoped>
.wisp-markdown :deep(p) {
  margin-block: 0.35rem;
}
.wisp-markdown :deep(p:first-child) {
  margin-top: 0;
}
.wisp-markdown :deep(p:last-child) {
  margin-bottom: 0;
}
.wisp-markdown {
  overflow-wrap: anywhere;
}
.wisp-markdown :deep(.wisp-markdown-scroll) {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
.wisp-markdown :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  margin-block: 0.5rem;
  border-radius: 0.75rem;
  padding: 0.625rem;
  background: color-mix(in srgb, var(--wisp-menu-bg) 60%, transparent);
  white-space: pre;
}
.wisp-markdown :deep(code) {
  overflow-wrap: anywhere;
  word-break: break-word;
  border-radius: 0.25rem;
  background: color-mix(in srgb, var(--wisp-menu-bg) 50%, transparent);
  padding-inline: 0.2em;
}
.wisp-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
}
.wisp-markdown :deep(table) {
  width: max-content;
  border-collapse: collapse;
}
.wisp-markdown :deep(th),
.wisp-markdown :deep(td) {
  white-space: nowrap;
}
.wisp-markdown :deep(ul) {
  list-style: disc;
  padding-inline-start: 1.25rem;
}
.wisp-markdown :deep(ol) {
  list-style: decimal;
  padding-inline-start: 1.25rem;
}
.wisp-markdown :deep(a) {
  color: var(--wisp-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
