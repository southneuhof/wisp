<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import type { CSSProperties } from 'vue'
import ChatDialog from './ChatDialog.vue'
import { useChatMessages } from './useChatMessages.js'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  themeStyle: CSSProperties
  createWorkspace: (title: string) => Promise<boolean>
}>()
const emit = defineEmits<{ closeAutoFocus: [event: Event] }>()

const t = useChatMessages()
const formId = useId()
const name = ref('')
const input = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const failed = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = ''
    failed.value = false
  }
})

function focusName(event: Event) {
  if (!input.value) return
  event.preventDefault()
  input.value.focus()
}

async function submit() {
  const title = name.value.trim()
  if (!title || submitting.value) return
  submitting.value = true
  failed.value = false
  try {
    if (await props.createWorkspace(title)) open.value = false
    else failed.value = true
  } catch {
    failed.value = true
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <ChatDialog
    v-model:open="open"
    :title="t.newWorkspace"
    :theme-style="themeStyle"
    :close-on-escape="!submitting"
    :close-on-outside-click="!submitting"
    @open-auto-focus="focusName"
    @close-auto-focus="emit('closeAutoFocus', $event)"
  >
    <form :id="formId" class="wisp-workspace-form" @submit.prevent="submit">
      <label class="wisp-workspace-field">
        <span>{{ t.workspaceName }}</span>
        <input
          ref="input"
          v-model="name"
          type="text"
          class="wisp-workspace-input"
          :readonly="submitting"
          required
        />
      </label>
      <p v-if="failed" class="wisp-workspace-error" role="alert">
        {{ t.workspaceCreateError }}
      </p>
    </form>
    <template #footer="{ close }">
      <button type="button" :disabled="submitting" @click="close">
        {{ t.cancel }}
      </button>
      <button
        type="submit"
        :form="formId"
        class="wisp-dialog-primary"
        :disabled="submitting || !name.trim()"
      >
        {{ submitting ? t.working : t.create }}
      </button>
    </template>
  </ChatDialog>
</template>

<style scoped>
.wisp-workspace-form {
  display: grid;
  gap: 12px;
}

.wisp-workspace-field {
  display: grid;
  gap: 6px;
  font-weight: 500;
}

.wisp-workspace-input {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--wisp-border);
  border-radius: 10px;
  padding-inline: 10px;
}

.wisp-workspace-error {
  color: var(--wisp-danger);
}

.wisp-workspace-input:focus-visible {
  outline: 2px solid var(--wisp-accent);
  outline-offset: 2px;
}
</style>
