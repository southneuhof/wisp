<script setup lang="ts">
import ChatIcon from './ChatIcon.vue'

defineProps<{
  title: string
  status?: string
  tone?: 'error'
}>()
</script>

<template>
  <section class="wisp-event-card" :aria-label="title">
    <div
      :class="{ 'wisp-event-error': tone === 'error' }"
      :role="tone === 'error' ? 'alert' : undefined"
    >
      <ChatIcon v-if="tone === 'error'" name="error" :size="18" />
      <div class="wisp-event-content">
        <p v-if="status" class="wisp-event-status" role="status">
          {{ status }}
        </p>
        <h2>{{ title }}</h2>
        <slot />
      </div>
    </div>
    <div
      v-if="$slots.actions"
      class="wisp-event-actions"
      :class="{ 'wisp-event-error-actions': tone === 'error' }"
    >
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.wisp-event-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--wisp-border);
  border-radius: 12px;
  background: var(--wisp-bg);
  color: var(--wisp-fg);
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.wisp-event-content {
  min-width: 0;
}

.wisp-event-card h2 {
  margin: 0;
  font-size: inherit;
  font-weight: 600;
}

.wisp-event-status {
  margin: 0 0 2px;
  color: var(--wisp-muted);
  font-size: 0.75rem;
}

.wisp-event-error {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 8px;
}

.wisp-event-error h2,
.wisp-event-error svg {
  color: var(--wisp-danger);
}

.wisp-event-error svg {
  margin-block-start: 1.5px;
}

.wisp-event-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 6px;
}

.wisp-event-actions :slotted(.wisp-event-button) {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 4px 12px;
  border: 1px solid var(--wisp-border);
  border-radius: 12px;
  background: var(--wisp-bg);
  color: var(--wisp-fg);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.wisp-event-actions :slotted(.wisp-event-button:hover:not(:disabled)) {
  background: var(--wisp-menu-hover);
}

.wisp-event-actions :slotted(.wisp-event-button:focus-visible) {
  outline: 2px solid var(--wisp-accent);
  outline-offset: 2px;
}

.wisp-event-actions :slotted(.wisp-event-button:disabled) {
  cursor: default;
  opacity: 0.5;
}

.wisp-event-actions :slotted(.wisp-event-primary) {
  border-color: transparent;
  background: var(--wisp-accent);
  color: var(--wisp-primary-fg);
}

.wisp-event-actions :slotted(.wisp-event-primary:hover:not(:disabled)) {
  background: var(--wisp-accent);
  filter: brightness(1.1);
}

.wisp-event-error-actions :slotted(.wisp-event-primary) {
  background: color-mix(in srgb, var(--wisp-bg) 88%, var(--wisp-danger));
  color: var(--wisp-danger);
}

.wisp-event-error-actions :slotted(.wisp-event-primary:hover:not(:disabled)) {
  background: color-mix(in srgb, var(--wisp-bg) 80%, var(--wisp-danger));
  filter: none;
}
</style>
