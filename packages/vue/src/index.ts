import { onMounted, onScopeDispose, readonly, shallowRef } from 'vue'
import type { DeepReadonly, ShallowRef } from 'vue'
import { createWispChat } from '@southneuhof/wisp-core'
import type {
  ChatOptions,
  ChatSnapshot,
  WispChatClient,
} from '@southneuhof/wisp-core'
export interface WispChatBinding {
  readonly client: WispChatClient
  readonly state: DeepReadonly<ShallowRef<ChatSnapshot>>
  readonly url: string
}
export function useWispChat(options: ChatOptions): WispChatBinding {
  const client = createWispChat(options)
  const state = shallowRef(client.getSnapshot())
  const unsubscribe = client.subscribe((snapshot) => {
    state.value = snapshot
  })
  onMounted(() => {
    void client.start().catch(() => {})
  })
  onScopeDispose(() => {
    unsubscribe()
    client.dispose()
  })
  return { client, state: readonly(state), url: options.url }
}
