<script setup lang="ts">
import { useChatMessages } from './useChatMessages.js'
import type { CSSProperties } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui'
import ChatIcon from './ChatIcon.vue'
import ChatSpinner from './ChatSpinner.vue'
import type { Conversation } from '@southneuhof/wisp-core'
defineProps<{
  title: string
  conversations: readonly Conversation[]
  selectedId: number | null
  loading: boolean
  busy: boolean
  error: string
  loadingList: boolean
  themeStyle: CSSProperties
}>()
const emit = defineEmits<{
  open: [open: boolean]
  select: [conversation: Conversation]
  new: []
  retry: []
}>()

const t = useChatMessages()
</script>
<template>
  <DropdownMenuRoot @update:open="emit('open', $event)">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="wisp-conversation-trigger wisp-flex wisp-h-9 wisp-min-w-0 wisp-max-w-72 wisp-items-center wisp-gap-2 wisp-rounded-full wisp-px-3 wisp-text-left wisp-text-sm wisp-text-on-surface focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary"
        aria-label="Select conversation"
        :disabled="loading"
      >
        <ChatIcon class="wisp-shrink-0" :size="18" name="chat_bubble_outline" />
        <ChatSpinner v-if="loading" />
        <span class="wisp-conversation-title wisp-truncate">{{ title }}</span>
        <ChatIcon
          v-if="!loading"
          class="wisp-conversation-chevron"
          :size="17"
          name="expand_more"
        />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        id="wisp-conversation-picker"
        :style="themeStyle"
        class="wisp-ui wisp-menu-content wisp-menu-with-footer wisp-z-[60] wisp-max-h-[60dvh] wisp-w-80 wisp-max-w-[calc(100vw-2rem)] wisp-overflow-hidden wisp-rounded-2xl wisp-border wisp-border-outline-variant wisp-bg-surface-container-high wisp-p-2 wisp-text-on-surface wisp-shadow-xl"
        align="start"
        :side-offset="8"
        aria-label="Conversations"
      >
        <div class="wisp-menu-list">
          <div
            v-if="conversations.length === 0 && loadingList"
            class="wisp-px-3 wisp-py-4 wisp-text-sm wisp-text-on-surface-variant"
            role="status"
          >
            <ChatSpinner class="wisp-mr-2 wisp-inline-block" />Loading
            conversations...
          </div>
          <div
            v-else-if="conversations.length === 0 && error"
            class="wisp-px-3 wisp-py-3 wisp-text-sm wisp-text-error"
            role="alert"
          >
            <p>{{ error }}</p>
            <button
              type="button"
              class="wisp-mt-2 wisp-font-semibold wisp-underline wisp-underline-offset-2"
              @click.stop="emit('retry')"
            >
              Try again
            </button>
          </div>
          <p
            v-else-if="conversations.length === 0"
            class="wisp-px-3 wisp-py-4 wisp-text-sm wisp-text-on-surface-variant"
          >
            No previous conversations.
          </p>
          <template v-else>
            <div
              v-if="error"
              class="wisp-px-3 wisp-py-2 wisp-text-xs wisp-text-error"
              role="status"
            >
              {{ error }}
            </div>
            <DropdownMenuItem
              v-for="conversation in conversations"
              :key="conversation.id"
              class="wisp-menu-item wisp-flex wisp-min-h-10 wisp-items-center wisp-gap-2 wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-left wisp-text-sm wisp-outline-none"
              :class="
                selectedId === conversation.id
                  ? 'wisp-bg-primary/10 wisp-text-primary'
                  : 'wisp-text-on-surface'
              "
              :disabled="busy || loading"
              @select="emit('select', conversation)"
            >
              <span class="wisp-min-w-0 wisp-flex-1 wisp-truncate">{{
                conversation.title || `Conversation ${conversation.id}`
              }}</span>
              <ChatIcon
                v-if="selectedId === conversation.id"
                :size="16"
                name="check"
              />
            </DropdownMenuItem>
          </template>
        </div>
        <div class="wisp-menu-footer">
          <DropdownMenuSeparator
            class="wisp-my-2 wisp-h-px wisp-bg-outline-variant"
          />
          <DropdownMenuItem
            class="wisp-menu-item wisp-menu-item-primary wisp-flex wisp-h-11 wisp-items-center wisp-gap-2 wisp-rounded-xl wisp-bg-primary wisp-px-3 wisp-text-sm wisp-font-semibold wisp-text-on-primary wisp-outline-none wisp-transition hover:wisp-brightness-110"
            :disabled="busy || loading"
            @select="emit('new')"
          >
            <ChatIcon :size="18" name="add" />
            <span>{{ t.newConversation }}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
