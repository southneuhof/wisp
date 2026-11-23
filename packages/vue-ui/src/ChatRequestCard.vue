<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChatClientError } from '@southneuhof/wisp-core'
import type { ChatActivity } from '@southneuhof/wisp-core'
import ChatEventCard from './ChatEventCard.vue'
import { useChatMessages } from './useChatMessages.js'

const props = defineProps<{
  entry: Extract<ChatActivity, { kind: 'request' }>
  nativeUrl: string
  decide?: (id: string, decision: 'approve' | 'reject') => Promise<void>
}>()

const t = useChatMessages()
const submitting = ref(false)
const error = ref('')
const requiresNative = computed(() => {
  const request = props.entry.request
  return (
    request.kind === 'connection' ||
    (request.kind === 'action' && request.requiresSetup)
  )
})
const status = computed(() => {
  if (props.entry.state === 'approved') return t.value.approved
  if (props.entry.state === 'rejected') return t.value.rejected
  return t.value.waitingForApproval
})

async function respond(decision: 'approve' | 'reject') {
  if (!props.decide || submitting.value || props.entry.state !== 'pending')
    return
  submitting.value = true
  error.value = ''
  try {
    await props.decide(props.entry.id, decision)
  } catch (cause) {
    error.value =
      cause instanceof ChatClientError ? cause.message : t.value.decideError
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <ChatEventCard :title="entry.title" :status="status">
    <p v-if="entry.detail" class="wisp-request-detail">{{ entry.detail }}</p>
    <dl v-if="entry.fields?.length" class="wisp-request-fields">
      <div v-for="(field, index) in entry.fields" :key="index">
        <dt>{{ field.label }}</dt>
        <dd>{{ field.value }}</dd>
      </div>
    </dl>
    <p
      v-if="error && entry.state === 'pending'"
      class="wisp-text-error"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-if="entry.state === 'pending'" #actions>
      <button
        v-if="decide"
        type="button"
        class="wisp-event-button"
        :disabled="submitting"
        @click="respond('reject')"
      >
        {{ t.reject }}
      </button>
      <a
        v-if="requiresNative || !decide"
        class="wisp-event-button wisp-event-primary"
        :href="nativeUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t.openCloudflare }}
      </a>
      <button
        v-else
        type="button"
        class="wisp-event-button wisp-event-primary"
        :disabled="submitting"
        @click="respond('approve')"
      >
        {{ t.approve }}
      </button>
    </template>
  </ChatEventCard>
</template>

<style scoped>
.wisp-request-detail {
  color: var(--wisp-muted);
  white-space: pre-line;
}

.wisp-request-fields {
  display: grid;
  gap: 6px;
  margin: 12px 0;
}

.wisp-request-fields dt {
  color: var(--wisp-muted);
  font-size: 0.75rem;
}

.wisp-request-fields dd {
  margin: 0;
  white-space: pre-line;
}
</style>
