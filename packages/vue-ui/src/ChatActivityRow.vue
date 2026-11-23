<script setup lang="ts">
import ChatIcon from './ChatIcon.vue'
import ChatSpinner from './ChatSpinner.vue'

defineProps<{
  title: string
  icon?: string
  status?: string
  statusVisible?: boolean
  running?: boolean
  failed?: boolean
  detail?: string
  expanded?: boolean
}>()
</script>

<template>
  <component
    :is="detail || $slots.default ? 'details' : 'div'"
    class="wisp-activity-row"
    :class="{ 'wisp-file-row': statusVisible }"
    :open="expanded || undefined"
  >
    <component
      :is="detail || $slots.default ? 'summary' : 'div'"
      class="wisp-activity-heading"
      :class="{ 'wisp-activity-failed': failed }"
    >
      <ChatSpinner v-if="running" />
      <ChatIcon v-else-if="icon" :name="icon" :size="16" />
      <span v-else aria-hidden="true" />
      <span class="wisp-activity-title">{{ title }}</span>
      <small v-if="statusVisible" class="wisp-activity-status">{{
        status
      }}</small>
      <span v-else-if="status" class="wisp-sr-only">{{ status }}</span>
      <ChatIcon
        v-if="detail || $slots.default"
        class="wisp-activity-chevron"
        name="expand_more"
        :size="16"
      />
    </component>
    <p v-if="detail" class="wisp-activity-detail">{{ detail }}</p>
    <slot />
  </component>
</template>

<style scoped>
.wisp-activity-row {
  --activity-icon-width: 18px;
  --activity-gap: 6px;
  min-width: 0;
  color: color-mix(in srgb, var(--wisp-muted) 60%, var(--wisp-fg));
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.5;
}

.wisp-activity-row + .wisp-activity-row {
  margin-top: 2px;
}

.wisp-activity-heading {
  display: grid;
  grid-template-columns: var(--activity-icon-width) minmax(0, 1fr) 16px;
  align-items: center;
  gap: var(--activity-gap);
  min-height: 32px;
  padding-inline: var(--activity-gap);
  border-radius: 8px;
}

summary.wisp-activity-heading {
  cursor: pointer;
}

summary.wisp-activity-heading:hover {
  background: var(--wisp-menu-hover);
}

summary.wisp-activity-heading:focus-visible {
  outline: 2px solid var(--wisp-accent);
  outline-offset: 2px;
}

summary.wisp-activity-heading::-webkit-details-marker {
  display: none;
}

.wisp-activity-title {
  overflow-wrap: anywhere;
}

.wisp-activity-row[open] .wisp-activity-chevron {
  rotate: 180deg;
}

.wisp-activity-failed {
  color: var(--wisp-danger);
}

.wisp-activity-detail {
  margin: 0;
  max-block-size: 10rem;
  overflow: auto;
  padding-block-end: 6px;
  padding-inline: calc(var(--activity-icon-width) + var(--activity-gap) * 2)
    var(--activity-gap);
  color: color-mix(in srgb, var(--wisp-muted) 90%, var(--wisp-fg));
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.wisp-file-row {
  margin-top: 4px;
  color: var(--wisp-muted);
}

.wisp-file-row .wisp-activity-heading {
  grid-template-columns:
    var(--activity-icon-width) minmax(0, 1fr)
    max-content 16px;
}

.wisp-activity-status {
  justify-self: end;
  font-size: 0.75rem;
}
</style>
