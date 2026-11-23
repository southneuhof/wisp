<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { ChatClientError } from '@southneuhof/wisp-core'
import type { ChatDraftChanges, ChatDraftFile } from '@southneuhof/wisp-core'
import ChatActivityRow from './ChatActivityRow.vue'
import ChatEventCard from './ChatEventCard.vue'
import { useChatMessages } from './useChatMessages.js'

const FileDiffPreview = defineAsyncComponent(
  () => import('./FileDiffPreview.vue'),
)
const props = defineProps<{
  changes: ChatDraftChanges
  running: boolean
  nativeUrl: string
  review?: (decision: 'accept' | 'discard') => Promise<void>
}>()
const t = useChatMessages()
const submitting = ref(false)
const error = ref('')
const title = computed(() =>
  props.changes.pending ? t.value.pendingChanges : t.value.editingFiles,
)
const incomplete = computed(
  () =>
    !props.changes.files.length ||
    props.changes.files.some(
      (file) =>
        file.binary || (file.before === undefined && file.after === undefined),
    ),
)
function fileStatus(state: ChatDraftFile['state']) {
  if (state === 'previewing') return t.value.previewing
  if (state === 'queued') return t.value.queued
  return t.value.appliedToDraft
}

async function reviewChanges(decision: 'accept' | 'discard') {
  if (
    !props.review ||
    submitting.value ||
    props.running ||
    !props.changes.pending
  )
    return
  if (decision === 'accept' && (!props.changes.ready || incomplete.value))
    return
  submitting.value = true
  error.value = ''
  try {
    await props.review(decision)
  } catch (cause) {
    error.value =
      cause instanceof ChatClientError ? cause.message : t.value.reviewError
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <ChatEventCard :title="title">
    <ChatActivityRow
      v-for="file in changes.files"
      :key="`${file.workpieceId}:${file.path}`"
      :title="file.path"
      :status="fileStatus(file.state)"
      :icon="file.state === 'applied' ? 'check' : undefined"
      :running="file.state === 'previewing'"
      status-visible
      expanded
    >
      <template
        v-if="
          !file.binary &&
          (file.before !== undefined || file.after !== undefined)
        "
        #default
      >
        <FileDiffPreview :file="file" />
      </template>
    </ChatActivityRow>
    <p v-if="incomplete" class="wisp-draft-note">
      {{ t.draftPreviewUnavailable }}
    </p>
    <p v-if="error" class="wisp-text-error" role="alert">{{ error }}</p>
    <template v-if="changes.pending" #actions>
      <a
        v-if="!review || !changes.ready || incomplete"
        class="wisp-event-button"
        :href="nativeUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t.openCloudflare }}
      </a>
      <template v-if="review">
        <button
          type="button"
          class="wisp-event-button"
          :disabled="submitting || running"
          @click="reviewChanges('discard')"
        >
          {{ t.discardChanges }}
        </button>
        <button
          type="button"
          class="wisp-event-button wisp-event-primary"
          :disabled="submitting || running || !changes.ready || incomplete"
          @click="reviewChanges('accept')"
        >
          {{ t.acceptChanges }}
        </button>
      </template>
    </template>
  </ChatEventCard>
</template>

<style scoped>
.wisp-draft-note {
  margin-block-start: 6px;
  color: var(--wisp-muted);
}
</style>
