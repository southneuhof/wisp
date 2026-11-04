'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createWispChat } from '@southneuhof/wisp-core'
import type {
  ChatOptions,
  ChatSnapshot,
  WispChatClient,
} from '@southneuhof/wisp-core'
export interface WispChatBinding {
  readonly client: WispChatClient
  readonly state: ChatSnapshot
  readonly url: string
}
export function useWispChat(options: ChatOptions): WispChatBinding {
  const [owner] = useState(() => ({
    client: createWispChat(options),
    url: options.url,
  }))
  const leases = useRef(0)
  const state = useSyncExternalStore(
    owner.client.subscribe,
    owner.client.getSnapshot,
    owner.client.getSnapshot,
  )
  useEffect(() => {
    leases.current++
    void owner.client.start().catch(() => {})
    return () => {
      leases.current--
      queueMicrotask(() => {
        if (leases.current === 0) owner.client.dispose()
      })
    }
  }, [owner])
  return { ...owner, state }
}
