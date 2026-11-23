<script setup lang="ts">
import { ref } from 'vue'
import { ChatClientError } from '@southneuhof/wisp-core'
import ChatEventCard from './ChatEventCard.vue'
import { useChatMessages } from './useChatMessages.js'

const props = defineProps<{
  title: string
  detail?: string
  retry?: () => Promise<void>
}>()
const t = useChatMessages()
const submitting = ref(false)
const error = ref('')

async function retryResponse() {
  if (submitting.value || !props.retry) return
  submitting.value = true
  error.value = ''
  try {
    await props.retry()
  } catch (cause) {
    error.value =
      cause instanceof ChatClientError ? cause.message : t.value.retryError
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <ChatEventCard :title="title" tone="error">
    <p v-if="detail" class="wisp-error-detail">{{ detail }}</p>
    <p v-if="error" class="wisp-text-error">{{ error }}</p>
    <template v-if="retry" #actions>
      <button
        class="wisp-event-button wisp-event-primary"
        type="button"
        :disabled="submitting"
        @click="retryResponse"
      >
        {{ t.retry }}
      </button>
    </template>
  </ChatEventCard>
</template>

<style scoped>
.wisp-error-detail {
  margin: 0;
  white-space: pre-line;
}
</style>
