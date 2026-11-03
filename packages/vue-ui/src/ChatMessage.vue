<script setup lang="ts">
import {
  MessagePrimitiveAttachments,
  MessagePrimitiveParts,
  MessagePrimitiveRoot,
  useAuiState,
} from '@assistant-ui/vue'
import type {
  ThreadAssistantMessagePart,
  ThreadUserMessagePart,
} from '@assistant-ui/core'
import ChatAttachmentPreview from './ChatAttachmentPreview.vue'
import ChatMarkdown from './ChatMarkdown.vue'
import type { NativeAttachmentDisplayData } from './runtime/conversation'

const role = useAuiState((state) => state.message.role)
const status = useAuiState((state) => state.message.status)
const hasRenderableContent = useAuiState(
  (state) =>
    state.message.content.some(
      (part: ThreadUserMessagePart | ThreadAssistantMessagePart) =>
        part.type === 'text' && part.text.trim().length > 0,
    ) || (state.message.attachments?.length ?? 0) > 0,
)
const emit = defineEmits<{ download: [data: NativeAttachmentDisplayData] }>()
</script>

<template>
  <MessagePrimitiveRoot
    v-if="hasRenderableContent"
    class="wisp-mb-2 last:wisp-mb-0 wisp-flex wisp-min-w-0 wisp-w-full"
    :class="role === 'user' ? 'wisp-justify-end' : 'wisp-justify-start'"
  >
    <article
      class="wisp-w-fit wisp-min-w-0 wisp-max-w-full wisp-rounded-2xl wisp-px-4 wisp-py-3 wisp-text-sm wisp-leading-relaxed wisp-shadow-sm"
      :class="
        role === 'user'
          ? 'wisp-bg-chat-user/90 wisp-text-chat-user-foreground'
          : 'wisp-bg-surface-container-high/80 wisp-text-on-surface'
      "
    >
      <div
        v-if="status?.type === 'incomplete'"
        class="wisp-mb-1 wisp-text-xs wisp-text-error"
      >
        Response did not finish.
      </div>
      <MessagePrimitiveParts>
        <template #text>
          <ChatMarkdown />
        </template>
      </MessagePrimitiveParts>
      <div class="wisp-mt-2">
        <MessagePrimitiveAttachments>
          <template #default>
            <div
              class="wisp-mb-1 wisp-min-w-0 wisp-max-w-full wisp-rounded-xl wisp-bg-surface-container/75 wisp-p-2 wisp-text-on-surface"
            >
              <ChatAttachmentPreview @download="emit('download', $event)" />
            </div>
          </template>
        </MessagePrimitiveAttachments>
      </div>
      <span v-if="status?.type === 'running'" class="wisp-sr-only" role="status"
        >Assistant is thinking</span
      >
    </article>
  </MessagePrimitiveRoot>
</template>
