<script setup lang="ts">
import type { CSSProperties } from 'vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import { useChatTheme } from './useChatTheme.js'

const open = defineModel<boolean>('open', { default: false })
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    themeStyle?: CSSProperties
    closeOnEscape?: boolean
    closeOnOutsideClick?: boolean
  }>(),
  { closeOnEscape: true, closeOnOutsideClick: true },
)
const emit = defineEmits<{
  openAutoFocus: [event: Event]
  closeAutoFocus: [event: Event]
}>()

const defaultTheme = useChatTheme(() => undefined)

function onEscape(event: Event) {
  if (!props.closeOnEscape) event.preventDefault()
}

function onOutside(event: Event) {
  if (!props.closeOnOutsideClick) event.preventDefault()
}
</script>

<template>
  <DialogRoot v-model:open="open" v-slot="{ close }">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="wisp-dialog-layer wisp-dialog-overlay" />
      <DialogContent
        :style="[defaultTheme, themeStyle]"
        v-bind="description ? {} : { 'aria-describedby': undefined }"
        class="wisp-ui wisp-dialog-layer wisp-dialog-content"
        @open-auto-focus="emit('openAutoFocus', $event)"
        @close-auto-focus="emit('closeAutoFocus', $event)"
        @escape-key-down="onEscape"
        @interact-outside="onOutside"
      >
        <DialogTitle class="wisp-dialog-title">{{ title }}</DialogTitle>
        <DialogDescription v-if="description" class="wisp-dialog-description">
          {{ description }}
        </DialogDescription>
        <div v-if="$slots.default" class="wisp-dialog-body">
          <slot :close="close" />
        </div>
        <div v-if="$slots.footer" class="wisp-dialog-footer">
          <slot name="footer" :close="close" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.wisp-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgb(0 0 0 / 22%);
}

.wisp-dialog-content {
  position: fixed;
  inset: 50% auto auto 50%;
  z-index: 71;
  width: min(400px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  padding: 20px;
  overflow-y: auto;
  transform: translate(-50%, -50%);
  border: 1px solid var(--wisp-border);
  border-radius: 16px;
  background: var(--wisp-bg);
  box-shadow: 0 12px 32px rgb(0 0 0 / 16%);
}

.wisp-dialog-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.wisp-dialog-description {
  margin-top: 4px;
  color: var(--wisp-muted);
}

.wisp-dialog-body {
  margin-top: 16px;
}

.wisp-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 8px;
  margin-top: 12px;
}

.wisp-dialog-footer :slotted(button) {
  min-height: 36px;
  padding-inline: 12px;
  border: 1px solid var(--wisp-border);
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.wisp-dialog-footer :slotted(button:hover:enabled) {
  background: var(--wisp-menu-hover);
}

.wisp-dialog-footer :slotted(.wisp-dialog-primary) {
  border-color: transparent;
  background: var(--wisp-accent);
  color: var(--wisp-primary-fg);
}

.wisp-dialog-footer :slotted(.wisp-dialog-primary:hover:enabled) {
  background: var(--wisp-accent);
  filter: brightness(1.1);
}

.wisp-dialog-footer :slotted(button:disabled) {
  opacity: 0.45;
  cursor: default;
}

.wisp-dialog-footer :slotted(button:focus-visible) {
  outline: 2px solid var(--wisp-accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: no-preference) {
  .wisp-dialog-overlay[data-state='open'] {
    animation: wisp-dialog-fade-in 150ms ease-out both;
  }

  .wisp-dialog-overlay[data-state='closed'] {
    animation: wisp-dialog-fade-out 150ms ease-in both;
  }

  .wisp-dialog-content[data-state='open'] {
    animation: wisp-dialog-enter 150ms ease-out both;
  }

  .wisp-dialog-content[data-state='closed'] {
    animation: wisp-dialog-exit 150ms ease-in both;
  }
}

@keyframes wisp-dialog-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes wisp-dialog-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes wisp-dialog-enter {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes wisp-dialog-exit {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.95);
  }
}
</style>
