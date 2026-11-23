<script setup lang="ts">
import type { ChatActivity, WispChatClient } from '@southneuhof/wisp-core'
import ChatActivityRow from './ChatActivityRow.vue'
import ChatErrorCard from './ChatErrorCard.vue'
import ChatRequestCard from './ChatRequestCard.vue'
import { useChatMessages } from './useChatMessages.js'

defineProps<{
  entries: readonly ChatActivity[]
  nativeUrl: string
  decide?: NonNullable<WispChatClient['activity']>['decide']
  retry?: () => Promise<void>
}>()

const t = useChatMessages()
</script>

<template>
  <div class="wisp-thread-activity">
    <template v-for="entry in entries" :key="entry.id">
      <ChatActivityRow
        v-if="entry.kind === 'reasoning'"
        :title="t.reasoning"
        icon="lightbulb"
        :detail="entry.text"
      />
      <ChatActivityRow
        v-else-if="entry.kind === 'tool'"
        :title="entry.title"
        :icon="entry.state === 'failed' ? 'close' : 'check'"
        :running="entry.state === 'running'"
        :failed="entry.state === 'failed'"
        :status="
          entry.state === 'complete'
            ? t.completed
            : entry.state === 'running'
              ? t.running
              : t.failed
        "
        :detail="entry.detail"
      />
      <ChatRequestCard
        v-else-if="entry.kind === 'request'"
        :entry="entry"
        :native-url="nativeUrl"
        :decide="decide"
      />
      <ChatErrorCard
        v-else-if="entry.kind === 'error'"
        :title="entry.title"
        :detail="entry.detail"
        :retry="entry.retryable ? retry : undefined"
      />
      <p
        v-else
        class="wisp-activity-notice wisp-activity-standalone"
        role="status"
      >
        {{ entry.text }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.wisp-thread-activity {
  display: grid;
  min-width: 0;
  margin-block: 2px 12px;
}

.wisp-thread-activity > :is(.wisp-event-card, .wisp-activity-standalone) {
  margin-block: 4px;
}

.wisp-activity-notice {
  margin: 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.wisp-activity-standalone {
  padding: 6px;
  color: var(--wisp-muted);
  font-size: 0.8125rem;
}
</style>
