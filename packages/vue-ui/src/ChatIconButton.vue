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
