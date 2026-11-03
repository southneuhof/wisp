<script setup lang="ts">
import ChatIcon from './ChatIcon.vue'
withDefaults(
  defineProps<{
    icon: string
    label: string
    size?: number
    danger?: boolean
  }>(),
  { size: 18, danger: false },
)
</script>
<template>
  <button
    type="button"
    class="wisp-icon-button"
    :class="{ 'wisp-icon-button-danger': danger }"
    :aria-label="label"
    :title="label"
  >
    <ChatIcon :name="icon" :size="size" />
  </button>
</template>
<style scoped>
.wisp-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--wisp-muted);
  transition:
    background-color 140ms ease,
    color 140ms ease;
}
.wisp-icon-button:hover,
.wisp-icon-button[data-highlighted] {
  color: var(--wisp-fg);
  background: color-mix(in srgb, var(--wisp-fg) 8%, transparent);
}
.wisp-icon-button:focus-visible {
  outline: 2px solid var(--wisp-accent);
  outline-offset: 2px;
}
.wisp-icon-button-danger {
  width: 28px;
  height: 28px;
  color: var(--wisp-danger);
}
.wisp-icon-button-danger:hover,
.wisp-icon-button-danger[data-highlighted] {
  color: var(--wisp-danger);
  background: color-mix(in srgb, var(--wisp-danger) 12%, transparent);
}
</style>
