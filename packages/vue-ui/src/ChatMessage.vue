<script setup lang="ts">
import { computed } from 'vue'
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
import ChatIcon from './ChatIcon.vue'
import ChatMarkdown from './ChatMarkdown.vue'
import type { NativeAttachmentDisplayData } from './runtime/conversation'
import { useChatMessages } from './useChatMessages.js'

const props = defineProps<{
  assistantAttachments?: ReadonlyMap<
    string,
    readonly NativeAttachmentDisplayData[]
  >
}>()
const emit = defineEmits<{ download: [data: NativeAttachmentDisplayData] }>()
const t = useChatMessages()
const messageId = useAuiState((state) => state.message.id)
const role = useAuiState((state) => state.message.role)
const status = useAuiState((state) => state.message.status)
const hasText = useAuiState((state) =>
  state.message.content.some(
    (part: ThreadUserMessagePart | ThreadAssistantMessagePart) =>
      part.type === 'text' && part.text.trim().length > 0,
  ),
)
const hasUserAttachments = useAuiState(
  (state) => (state.message.attachments?.length ?? 0) > 0,
)
const assistantFiles = computed(() =>
  props.assistantAttachments?.get(messageId.value),
)
</script>

<template>
  <slot>
    <MessagePrimitiveRoot
      v-if="hasText || hasUserAttachments || assistantFiles?.length"
      class="wisp-mb-2 last:wisp-mb-0 wisp-flex wisp-min-w-0 wisp-w-full"
      :class="role === 'user' ? 'wisp-justify-end' : 'wisp-justify-start'"
    >
      <article
        :data-message-role="role"
        class="wisp-w-fit wisp-min-w-0 wisp-max-w-full wisp-text-sm wisp-leading-relaxed"
        :class="
          role === 'user'
            ? 'wisp-rounded-2xl wisp-bg-chat-user/90 wisp-px-4 wisp-py-3 wisp-text-chat-user-foreground wisp-shadow-sm'
            : 'wisp-assistant-message wisp-text-on-surface'
        "
      >
        <MessagePrimitiveParts>
          <template #text>
            <ChatMarkdown />
          </template>
        </MessagePrimitiveParts>
        <div v-if="hasUserAttachments" class="wisp-mt-2">
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
        <ul v-if="assistantFiles?.length" class="wisp-assistant-files">
          <li v-for="file in assistantFiles" :key="file.attachmentId">
            <button
              type="button"
              class="wisp-attachment-link"
              :aria-label="`${t.download} ${file.name}`"
              @click="emit('download', file)"
            >
              <ChatIcon name="download" :size="16" />
              <span>{{ file.name }}</span>
            </button>
          </li>
        </ul>
        <span
          v-if="status?.type === 'running'"
          class="wisp-sr-only"
          role="status"
          >Assistant is thinking</span
        >
      </article>
    </MessagePrimitiveRoot>
  </slot>
  <slot name="after" :message-id="messageId" />
</template>

<style scoped>
.wisp-assistant-message {
  padding: 6px;
}

.wisp-assistant-files {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wisp-assistant-files li {
  min-width: 0;
}

.wisp-attachment-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-block-size: 32px;
  max-width: 100%;
  border-radius: 4px;
  text-align: start;
  cursor: pointer;
}

.wisp-attachment-link span {
  overflow-wrap: anywhere;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.wisp-attachment-link:hover span {
  text-decoration-thickness: 2px;
}

.wisp-attachment-link:focus-visible {
  outline: 2px solid var(--wisp-accent);
  outline-offset: 2px;
}
</style>
