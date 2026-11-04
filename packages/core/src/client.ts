import { z } from 'zod'
import type { RpcStub } from 'capnweb'
import type {
  Account,
  AuthSession,
  Attachment,
  ChatError,
  ChatOptions,
  ChatSnapshot,
  WispChatClient,
  Conversation,
  Message,
  Model,
  SendOptions,
  Workspace,
} from './types.js'
import {
  chatSchema,
  historySchema,
  profileSchema,
  workspaceSchema,
} from './internal/protocol.js'
import type {
  Event,
  NativeAccount,
  NativeChat,
  NativeMessage,
  NativePublic,
  NativeWorkspace,
} from './internal/protocol.js'
import {
  dispose,
  hashPassword,
  openPublic,
  rpcUrl,
  subscribeTarget,
} from './internal/transport.js'
import {
  FileValidationError,
  uploadFiles,
  validateDraft,
} from './internal/files.js'

const errorMessages: Record<ChatError['code'], string> = {
  connection:
    'Could not connect to CloudflareOS. Check your connection and try again.',
  credentials: 'Could not sign in. Check your credentials.',
  'unsupported-auth': 'This instance does not support password login.',
  workspace:
    'This workspace could not be opened. Check access or configure its resources in CloudflareOS.',
  model: 'Select an available chat model.',
  validation:
    'Use a message or up to five files, at most 4 MiB each and 5 MiB total. Images must be valid PNG, JPEG, or WebP.',
  cancelled: 'The operation was cancelled.',
  uncertain:
    'The request may have reached CloudflareOS. Check the conversation before sending again.',
  disposed: 'This client has been disposed.',
  operation: 'CloudflareOS could not complete the operation. Try again.',
}
export class ChatClientError extends Error {
  constructor(readonly code: ChatError['code']) {
    super(errorMessages[code])
    this.name = 'ChatClientError'
  }
}
interface Turn {
  id: string
  chatId: number | null
  user: Message
  stream: string
  startSequence: number
  settled: boolean
  active: boolean
  idle: boolean
  stopping: boolean
  dispatched: boolean
  stopSent: boolean
  finalized: boolean
  failed: boolean
  controller: AbortController
  view: number
}
interface Scope {
  epoch: number
  rpc: RpcStub<NativeWorkspace>
  workspace: Workspace
  phase: 'opening' | 'ready' | 'unavailable'
  models: Model[]
  modelId: string | null
  chats: Conversation[]
  selected: number | null
  view: number
  durable: Map<number, Message>
  local: Message[]
  turns: Map<number, Turn>
  pending: Turn | null
  buffering: boolean
  events: Event[]
  hasEarlier: boolean
  loadingEarlier: boolean
  loadingHistory: boolean
  subscription: RpcStub<object> | undefined
  subscriber: ReturnType<typeof subscribeTarget> | undefined
}
const persistedSchema = z.object({
  token: z.string(),
  accountId: z.string(),
  workspaceId: z.string().optional(),
  chatId: z.number().optional(),
})
type Persisted = z.infer<typeof persistedSchema>
function frozen<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) frozen(child)
  }
  return value
}
function nativeConversation(chat: NativeChat): Conversation {
  return {
    id: chat.id,
    title: chat.title,
    running: chat.activeAgent !== undefined,
  }
}
function toMessage(
  row: NativeMessage,
  workspaceId: string,
  accountId: string,
  endpoint: string,
  running = false,
): Message | undefined {
  if (row.type === 'error')
    return {
      id: `os:${row.chatId}:${row.sequence}`,
      role: 'assistant',
      text: 'CloudflareOS could not complete this response.',
      status: 'error',
      attachments: [],
      sequence: row.sequence,
    }
  if (
    row.type !== 'message' ||
    !row.author ||
    !['user', 'agent'].includes(row.author.type)
  )
    return
  return {
    id: `os:${row.chatId}:${row.sequence}`,
    role: row.author.type === 'user' ? 'user' : 'assistant',
    text: row.message ?? '',
    status: row.author.type === 'agent' && running ? 'running' : 'complete',
    sequence: row.sequence,
    attachments: (row.attachments ?? []).map((a) => ({
      id: a.id,
      name: a.name ?? 'Attachment',
      mimeType: a.mimeType,
      size: a.size,
      workspaceId,
      accountId,
      endpoint,
      chatId: row.chatId,
    })),
  }
}

export function createWispChat(options: ChatOptions): WispChatClient {
  return new Client(options)
}
class Client implements WispChatClient {
  readonly #options: ChatOptions
  #api: RpcStub<NativePublic> | undefined
  #authenticated: RpcStub<NativeAccount> | undefined
  #account: Account | null = null
  #token: string | null = null
  #scope: Scope | undefined
  #workspaceList: Workspace[] = []
  #epoch = 0
  #scopeEpoch = 0
  #disposed = false
  #starting = false
  #signingIn = false
  #passwordEnabled: boolean | null = null
  #connection: 'offline' | 'connected' | 'recovering' = 'offline'
  #error: ChatError | null = null
  #snapshot: ChatSnapshot
  #listeners = new Set<(snapshot: ChatSnapshot) => void>()
  #initializing: Promise<void> | undefined
  #timer: ReturnType<typeof setTimeout> | undefined
  #recovering = false
  #storage: Storage | undefined
  #storagePrefix: string
  constructor(options: ChatOptions) {
    const endpoint = new URL(options.url)
    rpcUrl(options.url)
    this.#options = { ...options, url: endpoint.origin }
    this.#storagePrefix = `os-chat:${endpoint.origin}:`
    this.#snapshot = frozen({
      status: 'signed-out',
      connection: 'offline',
      error: null,
      passwordAuthEnabled: null,
    })
  }
  getSnapshot = (): ChatSnapshot => this.#snapshot
  subscribe = (listener: (snapshot: ChatSnapshot) => void): (() => void) => {
    this.#listeners.add(listener)
    listener(this.#snapshot)
    return () => this.#listeners.delete(listener)
  }
  #assertOpen() {
    if (this.#disposed) throw new ChatClientError('disposed')
  }
  #emit() {
    let next: ChatSnapshot
    if (this.#account) {
      const s = this.#scope
      let workspace: Extract<
        ChatSnapshot,
        { status: 'authenticated' }
      >['workspace'] = { status: 'none' }
      if (s?.phase === 'opening')
        workspace = { status: 'opening', id: s.workspace.id }
      if (s?.phase === 'unavailable')
        workspace = {
          status: 'unavailable',
          workspace: { ...s.workspace },
          reason: errorMessages.workspace,
        }
      if (s?.phase === 'ready') {
        const turn = s.selected === null ? s.pending : s.turns.get(s.selected)
        const messages = [...s.durable.values(), ...s.local]
        if (turn?.stream)
          messages.push({
            id: `stream:${turn.id}`,
            role: 'assistant',
            text: turn.stream,
            status: turn.stopping ? 'cancelled' : 'running',
            attachments: [],
          })
        workspace = {
          status: 'ready',
          workspace: { ...s.workspace },
          models: [...s.models],
          modelId: s.modelId,
          conversations: [...s.chats],
          conversation:
            s.selected === null
              ? { status: 'draft', messages }
              : {
                  status: s.loadingHistory ? 'loading' : 'conversation',
                  id: s.selected,
                  messages,
                },
          running: !!turn && !turn.finalized,
          uploading: !!turn && !turn.settled && !turn.chatId,
          hasEarlier: s.hasEarlier,
          loadingEarlier: s.loadingEarlier,
        }
      }
      next = {
        status: 'authenticated',
        connection: this.#connection,
        error: this.#error,
        account: { ...this.#account },
        workspaces: [...this.#workspaceList],
        workspace,
      }
    } else
      next = {
        status: this.#disposed
          ? 'disposed'
          : this.#starting
            ? 'starting'
            : this.#signingIn
              ? 'signing-in'
              : 'signed-out',
        connection: this.#connection,
        error: this.#error,
        passwordAuthEnabled: this.#passwordEnabled,
      }
    this.#snapshot = frozen(next)
    for (const listener of this.#listeners) listener(this.#snapshot)
  }
  #failure(code: ChatError['code']): ChatClientError {
    this.#error = { code, message: errorMessages[code] }
    this.#emit()
    return new ChatClientError(code)
  }
  #current(scope: Scope): boolean {
    return (
      !this.#disposed &&
      this.#scope === scope &&
      scope.epoch === this.#scopeEpoch
    )
  }
  #requireAccount() {
    this.#assertOpen()
    if (!this.#authenticated || !this.#account)
      throw this.#failure('credentials')
    return this.#authenticated
  }
  #ready() {
    this.#assertOpen()
    const s = this.#scope
    if (!s || s.phase !== 'ready' || this.#connection !== 'connected')
      throw this.#failure('workspace')
    return s
  }
  #open() {
    if (this.#api) return this.#api
    const epoch = this.#epoch
    const api = openPublic(this.#options.url, () => {
      if (this.#disposed || this.#api !== api || this.#epoch !== epoch) return
      this.#connection = 'offline'
      this.#emit()
      if (this.#token && this.#account) void this.#recover()
    })
    this.#api = api
    return api
  }
  async start(): Promise<void> {
    this.#assertOpen()
    if (this.#initializing) return this.#initializing
    this.#error = null
    const initializing = this.#initialize()
    this.#initializing = initializing
    try {
      await initializing
    } catch (error) {
      if (this.#initializing === initializing) {
        this.#initializing = undefined
        const api = this.#api
        this.#api = undefined
        dispose(api)
      }
      throw error
    }
  }
  async #initialize() {
    const epoch = this.#epoch
    this.#starting = true
    this.#emit()
    try {
      try {
        this.#storage = globalThis.sessionStorage
      } catch {}
      const config = z
        .object({ passwordAuthEnabled: z.boolean() })
        .parse(await this.#open().getServerConfig())
      if (this.#epoch !== epoch || this.#disposed) return
      this.#passwordEnabled = config.passwordAuthEnabled
      this.#connection = 'connected'
      const stored = this.#readSession()
      if (stored) {
        try {
          await this.#authenticate(stored.token, epoch, stored.accountId)
          if (this.#epoch === epoch && this.#account) {
            await this.workspaces.list()
            if (stored.workspaceId) {
              try {
                await this.workspaces.select(stored.workspaceId)
                if (stored.chatId !== undefined)
                  await this.conversations.select(stored.chatId)
              } catch {
                this.#error = null
              }
            }
          }
        } catch {
          if (this.#epoch === epoch) {
            this.#clearStorage()
            dispose(this.#authenticated)
            this.#authenticated = undefined
            this.#account = null
            this.#token = null
          }
        }
      }
    } catch {
      if (this.#epoch === epoch && !this.#disposed)
        throw this.#failure('connection')
    } finally {
      if (this.#epoch === epoch && !this.#disposed) {
        this.#starting = false
        this.#emit()
      }
    }
  }
  #readSession(): Persisted | undefined {
    try {
      const account = this.#storage?.getItem(this.#storagePrefix + 'active')
      if (!account) return
      const value = this.#storage?.getItem(this.#storagePrefix + account)
      if (value) return persistedSchema.parse(JSON.parse(value))
    } catch {
      this.#clearStorage()
    }
    return
  }
  #save() {
    if (!this.#storage || !this.#token || !this.#account) return
    const s = this.#scope
    const value: Persisted = {
      token: this.#token,
      accountId: this.#account.id,
      ...(s ? { workspaceId: s.workspace.id } : {}),
      ...(s?.selected !== null && s?.selected !== undefined
        ? { chatId: s.selected }
        : {}),
    }
    try {
      this.#storage.setItem(
        this.#storagePrefix + this.#account.id,
        JSON.stringify(value),
      )
      this.#storage.setItem(this.#storagePrefix + 'active', this.#account.id)
    } catch {}
  }
  #clearStorage() {
    try {
      this.#storage ??= globalThis.sessionStorage
      const account = this.#storage?.getItem(this.#storagePrefix + 'active')
      if (account) this.#storage?.removeItem(this.#storagePrefix + account)
      this.#storage?.removeItem(this.#storagePrefix + 'active')
    } catch {}
  }
  async #authenticate(token: string, epoch: number, expectedAccount?: string) {
    const authenticated = await this.#open().authenticate(token)
    if (this.#epoch !== epoch || this.#disposed) {
      dispose(authenticated)
      return
    }
    try {
      const profile = profileSchema.parse(await authenticated.whoami())
      if (this.#epoch !== epoch || this.#disposed) {
        dispose(authenticated)
        return
      }
      if (expectedAccount && profile.id !== expectedAccount)
        throw new ChatClientError('credentials')
      dispose(this.#authenticated)
      this.#authenticated = authenticated
      this.#account = profile
      this.#token = token
      this.#connection = 'connected'
      this.#save()
    } catch (error) {
      dispose(authenticated)
      throw error
    }
  }
  async #signIn(
    resolveToken: () => Promise<string | null>,
    expectedAccount?: string,
  ): Promise<void> {
    this.#assertOpen()
    this.auth.signOut()
    const epoch = this.#epoch
    this.#signingIn = true
    this.#error = null
    this.#emit()
    try {
      await this.start()
      if (this.#epoch !== epoch || this.#disposed) return
      const token = await resolveToken()
      if (this.#epoch !== epoch || this.#disposed) return
      if (!token) throw new ChatClientError('credentials')
      await this.#authenticate(token, epoch, expectedAccount)
      if (this.#epoch !== epoch || this.#disposed) return
      await this.workspaces.list()
      this.#save()
    } catch (error) {
      if (this.#epoch === epoch && !this.#disposed) {
        if (this.#account && this.#token) {
          throw this.#failure(
            error instanceof ChatClientError ? error.code : 'operation',
          )
        }
        this.#clearStorage()
        this.#account = null
        this.#token = null
        dispose(this.#authenticated)
        this.#authenticated = undefined
        throw this.#failure(
          error instanceof ChatClientError ? error.code : 'credentials',
        )
      }
    } finally {
      if (this.#epoch === epoch && !this.#disposed) {
        this.#signingIn = false
        this.#emit()
      }
    }
  }
  readonly auth = {
    signIn: (input: { username: string; password: string }): Promise<void> => {
      return this.#signIn(async () => {
        if (!this.#passwordEnabled)
          throw new ChatClientError('unsupported-auth')
        const epoch = this.#epoch
        const hash = await hashPassword(input.username, input.password)
        if (this.#epoch !== epoch || this.#disposed) return ''
        return this.#open().login(input.username, hash)
      })
    },
    setSession: (session: AuthSession | null): Promise<void> => {
      if (session === null) {
        this.auth.signOut()
        return Promise.resolve()
      }
      const parsed = z
        .object({ token: z.string().min(1), accountId: z.string().min(1) })
        .safeParse(session)
      return this.#signIn(
        async () => {
          if (!parsed.success) throw new ChatClientError('credentials')
          return parsed.data.token
        },
        parsed.success ? parsed.data.accountId : undefined,
      )
    },
    signOut: (): void => {
      this.#assertOpen()
      this.#endSession(true)
    },
  }
  #endSession(forgetSession: boolean) {
    this.#epoch++
    if (forgetSession) this.#clearStorage()
    this.#clearScope()
    clearTimeout(this.#timer)
    this.#recovering = false
    dispose(this.#authenticated)
    dispose(this.#api)
    this.#authenticated = undefined
    this.#api = undefined
    this.#account = null
    this.#token = null
    this.#workspaceList = []
    this.#initializing = undefined
    this.#starting = false
    this.#signingIn = false
    this.#connection = 'offline'
    this.#error = null
    this.#emit()
  }
  #clearScope() {
    this.#scopeEpoch++
    const s = this.#scope
    this.#scope = undefined
    this.#emit()
    if (!s) return
    s.pending?.controller.abort()
    for (const t of s.turns.values()) t.controller.abort()
    dispose(s.subscription)
    dispose(s.subscriber)
    dispose(s.rpc)
  }
  readonly workspaces = {
    list: async (): Promise<readonly Workspace[]> => {
      const account = this.#requireAccount()
      const epoch = this.#epoch
      try {
        const list = z
          .array(workspaceSchema)
          .parse(await account.listWorkspaces())
        if (this.#epoch !== epoch || this.#disposed) return []
        const provisional = this.#scope?.workspace
        this.#workspaceList =
          provisional?.provisional && !list.some((w) => w.id === provisional.id)
            ? [provisional, ...list]
            : list
        this.#emit()
        return this.#snapshot.status === 'authenticated'
          ? this.#snapshot.workspaces
          : []
      } catch {
        if (this.#epoch === epoch && !this.#disposed)
          throw this.#failure('workspace')
        return []
      }
    },
    select: async (id: string): Promise<void> => {
      const account = this.#requireAccount()
      this.#clearScope()
      const epoch = this.#scopeEpoch
      const identity = this.#epoch
      this.#error = null
      let rpc: RpcStub<NativeWorkspace> | undefined
      try {
        rpc = await account.openWorkspace(id)
        if (
          epoch !== this.#scopeEpoch ||
          identity !== this.#epoch ||
          this.#disposed
        ) {
          dispose(rpc)
          return
        }
        await this.#activate(rpc, epoch)
      } catch {
        dispose(rpc)
        if (
          epoch === this.#scopeEpoch &&
          identity === this.#epoch &&
          !this.#disposed
        )
          throw this.#failure('workspace')
      }
    },
    create: async (input: { title?: string } = {}): Promise<Workspace> => {
      const account = this.#requireAccount()
      this.#clearScope()
      const epoch = this.#scopeEpoch
      const identity = this.#epoch
      let rpc: RpcStub<NativeWorkspace> | undefined
      try {
        rpc = await account.newWorkspace()
        if (
          epoch !== this.#scopeEpoch ||
          identity !== this.#epoch ||
          this.#disposed
        ) {
          dispose(rpc)
          throw new ChatClientError('cancelled')
        }
        const metadata = workspaceSchema.parse(await rpc.getMetadata())
        let namingFailed = false
        if (input.title)
          try {
            await rpc.setTitle(input.title)
          } catch {
            namingFailed = true
          }
        if (
          epoch !== this.#scopeEpoch ||
          identity !== this.#epoch ||
          this.#disposed
        ) {
          dispose(rpc)
          throw new ChatClientError('cancelled')
        }
        const workspace: Workspace = {
          ...metadata,
          ...(input.title && !namingFailed ? { title: input.title } : {}),
          provisional: true,
        }
        await this.#activate(rpc, epoch, workspace)
        if (this.#scopeEpoch !== epoch || this.#disposed)
          throw new ChatClientError('cancelled')
        if (namingFailed) this.#failure('operation')
        return workspace
      } catch (error) {
        if (this.#scope?.rpc !== rpc) dispose(rpc)
        if (
          epoch !== this.#scopeEpoch ||
          identity !== this.#epoch ||
          this.#disposed
        )
          throw new ChatClientError('cancelled')
        if (error instanceof ChatClientError) throw error
        throw this.#failure('uncertain')
      }
    },
  }
  async #activate(
    rpc: RpcStub<NativeWorkspace>,
    epoch: number,
    created?: Workspace,
  ) {
    const metadata = created ?? workspaceSchema.parse(await rpc.getMetadata())
    if (epoch !== this.#scopeEpoch || this.#disposed) {
      dispose(rpc)
      return
    }
    const s: Scope = {
      epoch,
      rpc,
      workspace: metadata,
      phase: 'opening',
      models: [],
      modelId: null,
      chats: [],
      selected: null,
      view: 0,
      durable: new Map(),
      local: [],
      turns: new Map(),
      pending: null,
      buffering: true,
      events: [],
      hasEarlier: false,
      loadingEarlier: false,
      loadingHistory: false,
      subscription: undefined,
      subscriber: undefined,
    }
    this.#scope = s
    this.#emit()
    if (metadata.role === 'use') {
      s.phase = 'unavailable'
      this.#error = {
        code: 'workspace',
        message: 'This workspace role does not allow chat.',
      }
      this.#emit()
      return
    }
    try {
      const [models, chats] = await Promise.all([
        rpc.listModels(),
        rpc.listChats(),
      ])
      if (!this.#current(s)) return
      s.models = z.array(profileSchema).parse(models)
      s.chats = z.array(chatSchema).parse(chats).map(nativeConversation)
      s.modelId =
        s.models.find((m) => m.id === this.#options.modelId)?.id ??
        s.models[0]?.id ??
        null
      s.subscriber = subscribeTarget((event) => {
        if (!this.#current(s)) return
        if (s.buffering) s.events.push(event)
        else this.#event(s, event)
      })
      const subscription = await rpc.subscribeToChat(s.subscriber)
      if (!this.#current(s)) {
        dispose(subscription)
        return
      }
      s.subscription = subscription
      s.phase = 'ready'
      s.buffering = false
      const events = s.events.splice(0)
      for (const e of events) this.#event(s, e)
      if (!this.#workspaceList.some((w) => w.id === metadata.id))
        this.#workspaceList = [metadata, ...this.#workspaceList]
      this.#save()
      this.#emit()
    } catch (error) {
      if (this.#current(s)) {
        s.phase = 'unavailable'
        this.#emit()
      }
      throw error
    }
  }
  readonly models = {
    select: (id: string) => {
      const s = this.#ready()
      if (!s.models.some((m) => m.id === id)) throw this.#failure('model')
      s.modelId = id
      this.#emit()
    },
  }
  #replaceHistory(s: Scope, rows: NativeMessage[], merge = false) {
    if (!merge) s.durable.clear()
    for (const row of rows) {
      const message = toMessage(
        row,
        s.workspace.id,
        this.#account?.id ?? '',
        this.#options.url,
      )
      if (message && row.chatId === s.selected)
        s.durable.set(row.sequence, message)
    }
    s.durable = new Map([...s.durable].sort((a, b) => a[0] - b[0]))
    this.#reconcileLocal(s)
  }
  #reconcileLocal(s: Scope) {
    const turn = s.selected === null ? s.pending : s.turns.get(s.selected)
    if (!turn) return
    const rows = [...s.durable.values()].filter(
      (m) => (m.sequence ?? -1) > turn.startSequence,
    )
    if (rows.some((m) => m.role === 'user'))
      s.local = s.local.filter((m) => m.id !== turn.user.id)
    if (rows.some((m) => m.role === 'assistant')) turn.stream = ''
  }
  readonly conversations = {
    list: async (): Promise<readonly Conversation[]> => {
      const s = this.#ready()
      const chats = z.array(chatSchema).parse(await s.rpc.listChats())
      if (!this.#current(s)) return []
      s.chats = chats.map(nativeConversation)
      this.#emit()
      return this.#snapshot.status === 'authenticated' &&
        this.#snapshot.workspace.status === 'ready'
        ? this.#snapshot.workspace.conversations
        : []
    },
    select: async (id: number): Promise<void> => {
      const s = this.#ready()
      if (!s.chats.some((c) => c.id === id)) throw this.#failure('workspace')
      const view = ++s.view
      s.selected = id
      s.durable.clear()
      s.local = []
      s.hasEarlier = false
      s.loadingEarlier = false
      s.loadingHistory = true
      s.buffering = true
      this.#error = null
      this.#emit()
      try {
        const page = historySchema.parse(await s.rpc.getChatHistory(id))
        if (!this.#current(s) || view !== s.view) return
        this.#replaceHistory(s, page.messages)
        s.hasEarlier = !!page.compacted
        const meta = s.chats.find((c) => c.id === id)
        if (meta?.running && !s.turns.has(id))
          s.turns.set(
            id,
            this.#turn(s, id, {
              id: `recovered:${id}`,
              role: 'user',
              text: '',
              status: 'complete',
              attachments: [],
            }),
          )
        this.#save()
      } catch {
        if (this.#current(s) && view === s.view)
          throw this.#failure('operation')
      } finally {
        if (this.#current(s) && view === s.view) {
          s.buffering = false
          s.loadingHistory = false
          for (const event of s.events.splice(0)) this.#event(s, event)
          this.#emit()
        }
      }
    },
    startNew: () => {
      const s = this.#ready()
      s.view++
      s.selected = null
      s.durable.clear()
      s.local = []
      s.hasEarlier = false
      s.loadingEarlier = false
      s.loadingHistory = false
      s.buffering = false
      for (const event of s.events.splice(0)) this.#event(s, event)
      this.#error = null
      this.#save()
      this.#emit()
    },
    send: async (input: SendOptions): Promise<void> => {
      const s = this.#ready()
      const text = input.text ?? ''
      const files = input.files ?? []
      try {
        validateDraft(text, files)
      } catch {
        throw this.#failure('validation')
      }
      if (!s.modelId) throw this.#failure('model')
      if (s.loadingHistory) throw this.#failure('operation')
      if (s.pending || (s.selected !== null && s.turns.has(s.selected)))
        throw this.#failure('operation')
      const user: Message = {
        id: `local:${crypto.randomUUID()}`,
        role: 'user',
        text,
        status: 'complete',
        attachments: [],
      }
      const turn = this.#turn(s, s.selected, user)
      turn.settled = false
      turn.active = false
      turn.dispatched = false
      turn.idle = false
      if (s.selected === null) s.pending = turn
      else s.turns.set(s.selected, turn)
      s.local.push(user)
      this.#error = null
      this.#emit()
      const rpc = s.rpc
      const model = s.modelId
      let dispatched = false
      try {
        const handles = await uploadFiles(files, rpc, turn.controller.signal)
        if (!this.#current(s)) {
          turn.controller.abort()
          return
        }
        turn.controller.signal.throwIfAborted()
        dispatched = true
        turn.dispatched = true
        if (turn.chatId === null) {
          const id = await rpc.newChat(text, model, undefined, handles)
          if (!this.#current(s)) return
          turn.chatId = id
          s.pending = null
          s.turns.set(id, turn)
          if (s.view === turn.view && s.selected === null) {
            s.selected = id
            this.#save()
          }
          const queued = s.events.splice(0)
          for (const event of queued) this.#event(s, event)
        } else
          await rpc.sendChatMessage(
            turn.chatId,
            text,
            model,
            undefined,
            handles,
          )
        if (!this.#current(s)) return
        turn.settled = true
        if (turn.stopping) await this.#stopTurn(s, turn).catch(() => {})
        if (!this.#current(s)) return
        const chats = z.array(chatSchema).parse(await rpc.listChats())
        if (!this.#current(s)) return
        s.chats = chats.map(nativeConversation)
        const meta = s.chats.find((c) => c.id === turn.chatId)
        if (meta?.running) turn.active = true
        else if (meta) turn.idle = true
        await this.#finish(s, turn)
      } catch (error) {
        if (!this.#current(s)) return
        turn.settled = true
        turn.failed = true
        const pendingCreation = s.pending === turn
        if (turn.chatId !== null) s.turns.delete(turn.chatId)
        else s.pending = null
        if (pendingCreation && !s.buffering)
          for (const event of s.events.splice(0)) this.#event(s, event)
        turn.stream = ''
        s.local = s.local.map((m) =>
          m.id === user.id ? { ...m, status: 'error' } : m,
        )
        throw this.#failure(
          turn.controller.signal.aborted && !dispatched
            ? 'cancelled'
            : error instanceof FileValidationError
              ? 'validation'
              : dispatched
                ? 'uncertain'
                : 'operation',
        )
      } finally {
        if (this.#current(s)) this.#emit()
      }
    },
    stop: async () => {
      const s = this.#ready()
      const turn = s.selected === null ? s.pending : s.turns.get(s.selected)
      if (!turn || turn.stopping) return
      turn.stopping = true
      turn.controller.abort()
      this.#emit()
      await this.#stopTurn(s, turn)
    },
    loadEarlier: async () => {
      const s = this.#ready()
      if (s.selected === null || !s.hasEarlier || s.loadingEarlier) return
      const id = s.selected,
        view = s.view
      const before = Math.min(...s.durable.keys())
      if (!Number.isFinite(before)) return
      s.loadingEarlier = true
      this.#emit()
      try {
        const page = historySchema.parse(await s.rpc.getChatHistory(id, before))
        if (!this.#current(s) || view !== s.view) return
        this.#replaceHistory(s, page.messages, true)
        s.hasEarlier = !!page.compacted
      } catch {
        if (this.#current(s) && view === s.view)
          throw this.#failure('operation')
      } finally {
        if (this.#current(s) && view === s.view) {
          s.loadingEarlier = false
          this.#emit()
        }
      }
    },
  }
  async #stopTurn(s: Scope, turn: Turn) {
    if (
      !turn.dispatched ||
      turn.chatId === null ||
      turn.stopSent ||
      !this.#current(s)
    )
      return
    turn.stopSent = true
    try {
      await s.rpc.stopAgent(turn.chatId)
      if (!this.#current(s)) return
      const chats = z.array(chatSchema).parse(await s.rpc.listChats())
      if (!this.#current(s)) return
      s.chats = chats.map(nativeConversation)
      const meta = s.chats.find((c) => c.id === turn.chatId)
      if (meta && !meta.running) turn.idle = true
      await this.#finish(s, turn)
    } catch {
      if (!this.#current(s)) return
      turn.stopSent = false
      turn.stopping = false
      throw this.#failure('operation')
    } finally {
      if (this.#current(s)) this.#emit()
    }
  }
  #turn(s: Scope, chatId: number | null, user: Message): Turn {
    return {
      id: crypto.randomUUID(),
      chatId,
      user,
      stream: '',
      startSequence: Math.max(-1, ...s.durable.keys()),
      settled: true,
      active: true,
      idle: false,
      stopping: false,
      dispatched: true,
      stopSent: false,
      finalized: false,
      failed: false,
      controller: new AbortController(),
      view: s.view,
    }
  }
  #event(s: Scope, event: Event) {
    if (!this.#current(s)) return
    if (s.pending && event.type !== 'generation') {
      s.events.push(event)
      return
    }
    if (event.type === 'generation') {
      for (const turn of s.turns.values()) turn.stream = ''
      if (s.pending) s.pending.stream = ''
      this.#emit()
      return
    }
    const id =
      event.type === 'metadata'
        ? event.chat.id
        : event.type === 'message'
          ? event.message.chatId
          : event.chatId
    const turn = s.turns.get(id)
    if (event.type === 'deleted') {
      s.chats = s.chats.filter((c) => c.id !== id)
      s.turns.delete(id)
      if (s.selected === id) {
        s.selected = null
        s.view++
        s.durable.clear()
        s.local = []
      }
    }
    if (event.type === 'metadata') {
      const meta = nativeConversation(event.chat)
      s.chats = [meta, ...s.chats.filter((c) => c.id !== id)]
      if (turn) {
        if (meta.running) {
          turn.active = true
          turn.idle = false
        } else {
          turn.idle = true
          void this.#finish(s, turn)
        }
      } else if (meta.running && s.selected === id)
        s.turns.set(
          id,
          this.#turn(s, id, {
            id: 'recovered',
            role: 'user',
            text: '',
            status: 'complete',
            attachments: [],
          }),
        )
    }
    if (event.type === 'message' && s.selected === id) {
      const msg = toMessage(
        event.message,
        s.workspace.id,
        this.#account?.id ?? '',
        this.#options.url,
        !!turn && !turn.idle,
      )
      if (msg) s.durable.set(event.message.sequence, msg)
      s.durable = new Map([...s.durable].sort((a, b) => a[0] - b[0]))
      this.#reconcileLocal(s)
    }
    if (event.type === 'stream' && turn) {
      if (event.event.type === 'textDelta')
        turn.stream += event.event.delta ?? ''
      if (event.event.type === 'streamReset') turn.stream = ''
    }
    this.#emit()
  }
  async #finish(s: Scope, turn: Turn) {
    if (
      turn.finalized ||
      !turn.settled ||
      !turn.idle ||
      turn.chatId === null ||
      !this.#current(s)
    )
      return
    turn.finalized = true
    const id = turn.chatId,
      view = s.view
    try {
      const page = historySchema.parse(await s.rpc.getChatHistory(id))
      if (!this.#current(s)) return
      if (s.selected === id && s.view === view) {
        this.#replaceHistory(s, page.messages, true)
        if (
          turn.stream &&
          !page.messages.some(
            (m) =>
              m.sequence > turn.startSequence && m.author?.type === 'agent',
          )
        )
          s.local.push({
            id: `final:${turn.id}`,
            role: 'assistant',
            text: turn.stream,
            status: turn.stopping ? 'cancelled' : 'complete',
            attachments: [],
          })
        s.local = s.local.filter(
          (m) =>
            m.id !== turn.user.id ||
            ![...s.durable.values()].some(
              (d) =>
                d.role === 'user' && (d.sequence ?? -1) > turn.startSequence,
            ),
        )
      }
    } catch {
      if (
        this.#current(s) &&
        s.selected === id &&
        s.view === view &&
        turn.stream
      )
        s.local.push({
          id: `final:${turn.id}`,
          role: 'assistant',
          text: turn.stream,
          status: turn.stopping ? 'cancelled' : 'complete',
          attachments: [],
        })
    } finally {
      if (this.#current(s)) {
        s.turns.delete(id)
        const meta = s.chats.find((c) => c.id === id)
        if (meta)
          s.chats = s.chats.map((c) =>
            c.id === id ? { ...c, running: false } : c,
          )
        this.#emit()
      }
    }
  }
  readonly attachments = {
    download: async (attachment: Attachment): Promise<Blob> => {
      const s = this.#ready()
      if (
        attachment.workspaceId !== s.workspace.id ||
        attachment.accountId !== this.#account?.id ||
        attachment.endpoint !== this.#options.url
      )
        throw this.#failure('workspace')
      const data = await s.rpc.getChatAttachmentContent(
        attachment.chatId,
        attachment.id,
      )
      if (!this.#current(s)) throw new ChatClientError('cancelled')
      return new Blob([new Uint8Array(data)], { type: attachment.mimeType })
    },
  }
  async #recover() {
    if (this.#recovering || !this.#token || !this.#account) return
    this.#recovering = true
    const epoch = this.#epoch,
      token = this.#token,
      account = this.#account.id,
      workspace = this.#scope?.workspace.id,
      chat = this.#scope?.selected
    this.#connection = 'recovering'
    this.#clearScope()
    dispose(this.#authenticated)
    dispose(this.#api)
    this.#authenticated = undefined
    this.#api = undefined
    this.#emit()
    for (let attempt = 0; attempt < 5; attempt++) {
      if (epoch !== this.#epoch || this.#disposed) return
      if (attempt)
        await new Promise<void>((resolve) => {
          this.#timer = setTimeout(resolve, Math.min(500 * 2 ** attempt, 8000))
        })
      if (epoch !== this.#epoch || this.#disposed) return
      try {
        await this.#authenticate(token, epoch, account)
        if (epoch !== this.#epoch || this.#disposed) return
        await this.workspaces.list()
        if (workspace) {
          await this.workspaces.select(workspace)
          if (chat !== null && chat !== undefined)
            await this.conversations.select(chat)
        }
        this.#connection = 'connected'
        this.#error = null
        this.#recovering = false
        this.#emit()
        return
      } catch {
        dispose(this.#authenticated)
        dispose(this.#api)
        this.#authenticated = undefined
        this.#api = undefined
        this.#connection = 'recovering'
      }
    }
    if (epoch === this.#epoch && !this.#disposed) {
      this.#connection = 'offline'
      this.#recovering = false
      this.#failure('connection')
    }
  }
  dispose = (): void => {
    if (this.#disposed) return
    this.#endSession(false)
    this.#disposed = true
    this.#emit()
    this.#listeners.clear()
  }
}
