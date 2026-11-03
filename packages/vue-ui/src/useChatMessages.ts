import { computed, inject, provide } from 'vue'
import type { ComputedRef, InjectionKey } from 'vue'
import { defaultMessages } from './messages.js'
import type { ChatMessages } from './messages.js'
const key: InjectionKey<ComputedRef<ChatMessages>> = Symbol('WispChatMessages')
export function provideChatMessages(messages: ComputedRef<ChatMessages>) {
  provide(key, messages)
}
export function useChatMessages() {
  return inject(
    key,
    computed(() => defaultMessages),
  )
}
