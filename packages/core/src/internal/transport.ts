import { newWebSocketRpcSession, RpcTarget, RpcStub } from 'capnweb'
import { chatSchema, messageSchema, streamEventSchema } from './protocol.js'
import type {
  NativePublic,
  Subscriber,
  Event,
  ActionsSubscriber,
} from './protocol.js'
export function rpcUrl(url: string): string {
  const parsed = new URL(url)
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error('Use a CloudflareOS HTTP or HTTPS URL without credentials')
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  parsed.pathname = '/api'
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}
export function openPublic(
  url: string,
  onBroken: () => void,
): RpcStub<NativePublic> {
  const api = newWebSocketRpcSession<NativePublic>(rpcUrl(url))
  api.onRpcBroken(onBroken)
  return api
}
export function dispose(value: { [Symbol.dispose](): void } | undefined): void {
  try {
    value?.[Symbol.dispose]()
  } catch {}
}
export function subscribeTarget(
  emit: (event: Event) => void,
): RpcStub<Subscriber> {
  class Target extends RpcTarget implements Subscriber {
    streamGeneration(generation: number) {
      emit({ type: 'generation', generation })
    }
    metadata(value: unknown) {
      const chat = chatSchema.parse(value)
      emit({ type: 'metadata', chat })
    }
    deleted(chatId: number) {
      emit({ type: 'deleted', chatId })
    }
    message(value: unknown) {
      emit({ type: 'message', message: messageSchema.parse(value) })
    }
    changeApplied(
      chatId: number,
      generation: number,
      revision: number,
      author: unknown,
      change: unknown,
    ) {
      emit({ type: 'change', chatId, generation, revision, author, change })
    }
    stream(chatId: number, value: unknown) {
      const event = streamEventSchema.safeParse(value)
      if (event.success) emit({ type: 'stream', chatId, event: event.data })
    }
  }
  return new RpcStub<Subscriber>(new Target())
}
export function subscribeActionsTarget(
  emit: (event: Event) => void,
): RpcStub<ActionsSubscriber> {
  class Target extends RpcTarget implements ActionsSubscriber {
    entry(value: unknown) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return
      const action = value as Record<string, unknown>
      const chatId =
        typeof action.chatId === 'number' ? action.chatId : undefined
      emit({ type: 'action', chatId, action })
    }
    ready() {}
  }
  return new RpcStub<ActionsSubscriber>(new Target())
}

export async function hashPassword(
  username: string,
  password: string,
): Promise<Uint8Array> {
  const { argon2id } = await import('hash-wasm')
  const saltPrefix = new Uint8Array([
    0xd9, 0x4e, 0x54, 0x1d, 0x29, 0xc1, 0x03, 0x74, 0x73, 0x7e, 0xb3, 0xe3,
    0x34, 0x6d, 0x8f, 0x21,
  ])
  const name = new TextEncoder().encode(username)
  const salt = new Uint8Array(saltPrefix.length + name.length)
  salt.set(saltPrefix)
  salt.set(name, saltPrefix.length)
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'binary',
  })
}
