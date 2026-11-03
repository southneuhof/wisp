<script setup lang="ts">
import ChatIconButton from './ChatIconButton.vue'
import ChatIcon from './ChatIcon.vue'
import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  AttachmentPrimitiveName,
  AttachmentPrimitiveThumb,
  AttachmentPrimitiveRemove,
  useAuiState,
} from '@assistant-ui/vue'
import type { ThreadUserMessagePart } from '@assistant-ui/core'
import { nativeAttachmentData } from './runtime/conversation'

defineProps<{ removable?: boolean }>()
const emit = defineEmits<{
  download: [data: NonNullable<ReturnType<typeof nativeAttachmentData>>]
}>()

const file = useAuiState((state) => state.attachment.file)
const content = useAuiState((state) => state.attachment.content)
const contentType = useAuiState((state) => state.attachment.contentType)
const status = useAuiState((state) => state.attachment.status)
const sourceUrl = ref('')
let ownedUrl: string | undefined

const native = computed(() => {
  const part = content.value?.find(
    (candidate: ThreadUserMessagePart) =>
      candidate.type === 'data' && candidate.name === 'wisp-native',
  )
  return part?.type === 'data' ? nativeAttachmentData(part.data) : undefined
})
const mimeType = computed(() => contentType.value || file.value?.type || '')
const previewUrl = computed(
  () => sourceUrl.value || native.value?.previewUrl || '',
)
const isImage = computed(
  () =>
    mimeType.value.startsWith('image/') &&
    ['image/png', 'image/jpeg', 'image/webp'].includes(mimeType.value),
)
const canDownload = computed(
  () =>
    native.value?.chatId !== undefined &&
    native.value.attachmentId !== undefined,
)

watch(
  file,
  (currentFile) => {
    if (ownedUrl) URL.revokeObjectURL(ownedUrl)
    ownedUrl = undefined
    sourceUrl.value = ''
    if (
      currentFile &&
      ['image/png', 'image/jpeg', 'image/webp'].includes(mimeType.value)
    ) {
      ownedUrl = URL.createObjectURL(currentFile)
      sourceUrl.value = ownedUrl
    }
  },
  { immediate: true },
)

onScopeDispose(() => {
  if (ownedUrl) URL.revokeObjectURL(ownedUrl)
})

function download(): void {
  if (native.value) emit('download', native.value)
}
</script>

<template>
  <div class="wisp-flex wisp-min-w-0 wisp-items-center wisp-gap-2">
    <img
      v-if="isImage && previewUrl"
      :src="previewUrl"
      :alt="`Preview ${native?.name ?? file?.name ?? ''}`"
      class="wisp-h-12 wisp-w-12 wisp-shrink-0 wisp-rounded-lg wisp-object-cover"
    />
    <AttachmentPrimitiveThumb
      v-else
      class="wisp-flex wisp-h-10 wisp-min-w-10 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-lg wisp-bg-surface-container-high/70 wisp-px-2 wisp-text-[10px] wisp-font-semibold wisp-uppercase wisp-text-on-surface-variant"
    />
    <div class="wisp-min-w-0 wisp-flex-1">
      <div class="wisp-max-w-full wisp-truncate wisp-text-xs wisp-font-medium">
        <AttachmentPrimitiveName />
      </div>
      <span
        v-if="status.type === 'running'"
        class="wisp-block wisp-text-[10px] wisp-text-on-surface-variant"
        role="status"
        >Uploading attachment...</span
      >
      <span
        v-else-if="status.type === 'incomplete'"
        class="wisp-block wisp-text-[10px] wisp-text-error"
        >{{ status.message || 'Upload failed. Try again.' }}</span
      >
    </div>
    <ChatIconButton
      v-if="canDownload"
      class="wisp-flex wisp-shrink-0 wisp-items-center wisp-justify-center wisp-text-on-surface-variant hover:wisp-bg-on-surface/10 focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary"
      :label="`Download ${native?.name ?? 'attachment'}`"
      @click="download"
      icon="download"
    />
    <AttachmentPrimitiveRemove
      v-if="removable"
      class="wisp-flex wisp-h-8 wisp-w-8 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-full wisp-text-on-surface-variant hover:wisp-bg-on-surface/10 focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary"
      aria-label="Remove attachment"
    >
      <ChatIcon :size="18" name="close" />
    </AttachmentPrimitiveRemove>
  </div>
</template>
