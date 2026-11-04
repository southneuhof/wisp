import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RpcStub } from 'capnweb'
import { createWispChat } from '../packages/core/src/client.js'
import type {
  NativeWorkspace,
  Subscriber,
} from '../packages/core/src/internal/protocol.js'
const network = vi.hoisted(() => ({
  open: vi.fn(),
  hash: vi.fn(async () => new Uint8Array([1])),
}))
vi.mock('../packages/core/src/internal/transport.js', async (original) => ({
  ...(await original<
    typeof import('../packages/core/src/internal/transport.js')
  >()),
  openPublic: network.open,
  hashPassword: network.hash,
}))
function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: Error) => void = () => {}
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function workspace(id = 'a') {
  let subscriber: RpcStub<Subscriber> | undefined
  const value = {
    getMetadata: vi.fn<() => Promise<unknown>>(async () => ({
      id,
      title: id,
      role: 'build',
    })),
    setTitle: vi.fn(async () => {}),
    listModels: vi.fn<() => Promise<unknown>>(async () => [
      { id: 'model', name: 'Model' },
    ]),
    listChats: vi.fn<() => Promise<unknown>>(async () => [
      { id: 1, title: 'Conversation' },
    ]),
    getChatHistory: vi.fn<() => Promise<unknown>>(async () => ({
      messages: [],
    })),
    subscribeToChat: vi.fn<(s: RpcStub<Subscriber>) => Promise<Disposable>>(
      async (s) => {
        subscriber = s
        return { [Symbol.dispose]: vi.fn() }
      },
    ),
    newChat: vi.fn(async () => 2),
    sendChatMessage: vi.fn(async () => {}),
    stopAgent: vi.fn(async () => {}),
    uploadBlob: vi.fn(async (_bytes: Uint8Array) => 'blob-oid'),
    getChatAttachmentContent: vi.fn<() => Promise<Uint8Array>>(
      async () => new Uint8Array([42]),
    ),
    [Symbol.dispose]: vi.fn(),
  }
  return {
    value,
    get subscriber() {
      if (!subscriber) throw new Error('No subscription')
      return subscriber
    },
  }
}
function setup() {
  const a = workspace('a'),
    b = workspace('b')
  const account = {
    whoami: vi.fn(async () => ({ id: 'alice', name: 'Alice' })),
    listWorkspaces: vi.fn<() => Promise<unknown>>(async () => [
      { id: 'a', title: 'A', role: 'build' },
      { id: 'b', title: 'B', role: 'build' },
    ]),
    openWorkspace: vi.fn(async (id: string) =>
      id === 'a' ? a.value : b.value,
    ),
    newWorkspace: vi.fn(async () => a.value),
    [Symbol.dispose]: vi.fn(),
  }
  const api = {
    getServerConfig: vi.fn(async () => ({ passwordAuthEnabled: true })),
    login: vi.fn(async () => 'alice:secret'),
    authenticate: vi.fn(async () => account),
    [Symbol.dispose]: vi.fn(),
  }
  network.open.mockReturnValue(api)
  const client = createWispChat({ url: 'http://os.example' })
  return { a, b, account, api, client }
}
async function login(f: ReturnType<typeof setup>) {
  await f.client.auth.signIn({ username: 'alice', password: 'secret' })
}
function ready(f: ReturnType<typeof setup>) {
  const s = f.client.getSnapshot()
  if (s.status !== 'authenticated' || s.workspace.status !== 'ready')
    throw new Error('Not ready')
  return s.workspace
}
function row(
  sequence: number,
  author = 'agent',
  message = 'answer',
  chatId = 1,
) {
  return {
    chatId,
    sequence,
    type: 'message',
    author: { type: author },
    message,
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})
describe('account and workspace boundaries', () => {
  it('does no network work until started and keeps secrets out of snapshots', async () => {
    const f = setup()
    expect(network.open).not.toHaveBeenCalled()
    await login(f)
    expect(JSON.stringify(f.client.getSnapshot())).not.toContain('secret')
    expect(f.client.getSnapshot().status).toBe('authenticated')
    f.client.dispose()
  })
  it('ignores authentication resolving after sign out', async () => {
    const f = setup()
    const identity = deferred<{ id: string; name: string }>()
    f.account.whoami.mockReturnValue(identity.promise)
    const pending = login(f)
    await vi.waitFor(() => expect(f.account.whoami).toHaveBeenCalled())
    f.client.auth.signOut()
    identity.resolve({ id: 'alice', name: 'Alice' })
    await pending
    expect(f.client.getSnapshot().status).toBe('signed-out')
    expect(f.account[Symbol.dispose]).toHaveBeenCalled()
    f.client.dispose()
  })
  it('ignores a superseded workspace response and disposes it', async () => {
    const f = setup()
    await login(f)
    const old = deferred<typeof f.a.value>()
    f.account.openWorkspace.mockImplementation(async (id) =>
      id === 'a' ? old.promise : f.b.value,
    )
    const first = f.client.workspaces.select('a')
    await f.client.workspaces.select('b')
    old.resolve(f.a.value)
    await first
    expect(ready(f).workspace.id).toBe('b')
    expect(f.a.value[Symbol.dispose]).toHaveBeenCalled()
    f.client.dispose()
  })
  it('disposes subscription handles arriving after a workspace switch', async () => {
    const f = setup()
    await login(f)
    const late = deferred<{ [Symbol.dispose]: () => void }>()
    f.a.value.subscribeToChat.mockReturnValue(late.promise)
    const first = f.client.workspaces.select('a')
    await vi.waitFor(() => expect(f.a.value.subscribeToChat).toHaveBeenCalled())
    await f.client.workspaces.select('b')
    const handle = { [Symbol.dispose]: vi.fn() }
    late.resolve(handle)
    await first
    expect(handle[Symbol.dispose]).toHaveBeenCalled()
    expect(ready(f).workspace.id).toBe('b')
    f.client.dispose()
  })
  it('keeps a provisional created workspace even when native listing omits it', async () => {
    const f = setup()
    await login(f)
    f.account.listWorkspaces.mockResolvedValue([])
    await f.client.workspaces.create({ title: 'New' })
    await f.client.workspaces.list()
    const state = f.client.getSnapshot()
    expect(
      state.status === 'authenticated' && state.workspaces[0]?.provisional,
    ).toBe(true)
    expect(ready(f).workspace.title).toBe('New')
    expect(f.account.newWorkspace).toHaveBeenCalledTimes(1)
    f.client.dispose()
  })
  it('preserves a created workspace when naming fails', async () => {
    const f = setup()
    await login(f)
    f.a.value.setTitle.mockRejectedValue(new Error('failed'))
    await f.client.workspaces.create({ title: 'New' })
    expect(ready(f).workspace.id).toBe('a')
    expect(f.client.getSnapshot().error?.code).toBe('operation')
    expect(f.account.newWorkspace).toHaveBeenCalledTimes(1)
    f.client.dispose()
  })
  it('shows use-role workspaces without attempting chat operations', async () => {
    const f = setup()
    await login(f)
    f.a.value.getMetadata.mockResolvedValue({
      id: 'a',
      title: 'A',
      role: 'use',
    })
    await f.client.workspaces.select('a')
    const s = f.client.getSnapshot()
    expect(s.status === 'authenticated' && s.workspace.status).toBe(
      'unavailable',
    )
    expect(f.a.value.listChats).not.toHaveBeenCalled()
    f.client.dispose()
  })
  it('does not restore history from the workspace selected before a slow read', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const history = deferred<{ messages: ReturnType<typeof row>[] }>()
    f.a.value.getChatHistory.mockReturnValue(history.promise)
    const first = f.client.conversations.select(1)
    await f.client.workspaces.select('b')
    history.resolve({ messages: [row(1, 'user', 'private A')] })
    await first
    expect(JSON.stringify(f.client.getSnapshot())).not.toContain('private A')
    f.client.dispose()
  })
  it('keeps disposal terminal while sign out permits another login', async () => {
    const f = setup()
    await login(f)
    f.client.auth.signOut()
    await login(f)
    expect(f.client.getSnapshot().status).toBe('authenticated')
    f.client.dispose()
    f.client.dispose()
    await expect(f.client.start()).rejects.toMatchObject({ code: 'disposed' })
  })
})
describe('conversation lifecycle', () => {
  it('reconciles early new-chat events against durable final history', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const created = deferred<number>()
    f.a.value.newChat.mockReturnValue(created.promise)
    const pending = f.client.conversations.send({ text: 'hello' })
    await vi.waitFor(() => expect(f.a.value.newChat).toHaveBeenCalled())
    await f.a.subscriber.message(row(0, 'user', 'hello', 2))
    await f.a.subscriber.stream(2, { type: 'textDelta', delta: 'answer' })
    await f.a.subscriber.metadata({
      id: 2,
      title: 'New',
      activeAgent: { id: 'model' },
    })
    await f.a.subscriber.metadata({ id: 2, title: 'New' })
    f.a.value.getChatHistory.mockResolvedValue({
      messages: [row(0, 'user', 'hello', 2), row(1, 'agent', 'answer', 2)],
    })
    created.resolve(2)
    await pending
    await vi.waitFor(() => expect(ready(f).running).toBe(false))
    expect(ready(f).conversation.messages.map((m) => m.text)).toEqual([
      'hello',
      'answer',
    ])
    f.client.dispose()
  })
  it('displays live deltas and reconciles final history when the agent becomes idle', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    await f.client.conversations.select(1)
    f.a.value.listChats.mockResolvedValue([
      { id: 1, title: 'C', activeAgent: { id: 'model' } },
    ])
    await f.client.conversations.send({ text: 'question' })
    await f.a.subscriber.stream(1, { type: 'textDelta', delta: 'live' })
    expect(ready(f).conversation.messages.some((m) => m.text === 'live')).toBe(
      true,
    )
    f.a.value.getChatHistory.mockResolvedValue({
      messages: [row(0, 'user', 'question'), row(1, 'agent', 'final')],
    })
    await f.a.subscriber.metadata({ id: 1, title: 'C' })
    await vi.waitFor(() => expect(ready(f).running).toBe(false))
    expect(ready(f).conversation.messages.map((m) => m.text)).toEqual([
      'question',
      'final',
    ])
    f.client.dispose()
  })
  it('does not dispatch an upload after its workspace was replaced', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const bytes = deferred<ArrayBuffer>()
    const file = new File(['one'], 'one.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'arrayBuffer', { value: () => bytes.promise })
    const sending = f.client.conversations.send({ files: [file] })
    await f.client.workspaces.select('b')
    bytes.resolve(new TextEncoder().encode('one').buffer)
    await sending
    expect(f.a.value.newChat).not.toHaveBeenCalled()
    expect(f.b.value.newChat).not.toHaveBeenCalled()
    f.client.dispose()
  })
  it('rejects oversized files before native upload or send', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    await expect(
      f.client.conversations.send({
        files: [new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big')],
      }),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(f.a.value.uploadBlob).not.toHaveBeenCalled()
    f.client.dispose()
  })
  it('does not resend when a dispatched message outcome is uncertain', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    await f.client.conversations.select(1)
    f.a.value.sendChatMessage.mockRejectedValue(new Error('connection failed'))
    await expect(
      f.client.conversations.send({ text: 'hello' }),
    ).rejects.toMatchObject({ code: 'uncertain' })
    expect(f.a.value.sendChatMessage).toHaveBeenCalledTimes(1)
    f.client.dispose()
  })
  it('does not let stale earlier history merge into another conversation', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    f.a.value.getChatHistory.mockResolvedValue({
      messages: [row(10)],
      compacted: { to: 10, summary: 'old' },
    })
    await f.client.conversations.select(1)
    const page = deferred<{ messages: ReturnType<typeof row>[] }>()
    f.a.value.getChatHistory.mockReturnValueOnce(page.promise)
    const earlier = f.client.conversations.loadEarlier()
    f.client.conversations.startNew()
    page.resolve({ messages: [row(1, 'user', 'old secret')] })
    await earlier
    expect(ready(f).conversation.status).toBe('draft')
    expect(ready(f).conversation.messages).toEqual([])
    f.client.dispose()
  })
})

describe('files, model selection, and persisted sessions', () => {
  it('rejects password-disabled instances without hashing or submitting a password', async () => {
    const f = setup()
    f.api.getServerConfig.mockResolvedValue({ passwordAuthEnabled: false })
    await expect(login(f)).rejects.toMatchObject({ code: 'unsupported-auth' })
    expect(f.api.login).not.toHaveBeenCalled()
    expect(network.hash).not.toHaveBeenCalled()
    f.client.dispose()
  })
  it('disables send when the workspace offers no chat models', async () => {
    const f = setup()
    await login(f)
    f.a.value.listModels.mockResolvedValue([])
    await f.client.workspaces.select('a')
    await expect(
      f.client.conversations.send({ text: 'hello' }),
    ).rejects.toMatchObject({ code: 'model' })
    expect(f.a.value.newChat).not.toHaveBeenCalled()
    f.client.dispose()
  })
  it('uploads original file bytes and supports a file-only message', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const file = new File(['data'], 'input.csv', { type: 'text/csv' })
    const content = new TextEncoder().encode('A,B\n1,2')
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => content.buffer,
    })
    await f.client.conversations.send({ files: [file] })
    expect(Array.from(f.a.value.uploadBlob.mock.calls[0]?.[0] ?? [])).toEqual(
      Array.from(content),
    )
    expect(f.a.value.newChat).toHaveBeenCalledWith('', 'model', undefined, [
      { oid: 'blob-oid', mimeType: 'text/csv', name: 'input.csv' },
    ])
    f.client.dispose()
  })
  it('stops the selected native turn and keeps the final durable answer', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    await f.client.conversations.select(1)
    f.a.value.listChats.mockResolvedValue([
      { id: 1, title: 'C', activeAgent: { id: 'model' } },
    ])
    await f.client.conversations.send({ text: 'question' })
    await f.a.subscriber.stream(1, { type: 'textDelta', delta: 'partial' })
    f.a.value.stopAgent.mockImplementation(async () => {
      f.a.value.listChats.mockResolvedValue([{ id: 1, title: 'C' }])
    })
    await f.client.conversations.stop()
    expect(f.a.value.stopAgent).toHaveBeenCalledWith(1)
    expect(ready(f).running).toBe(false)
    expect(
      ready(f).conversation.messages.some(
        (m) => m.text === 'partial' && m.status === 'cancelled',
      ),
    ).toBe(true)
    f.client.dispose()
  })
  it('refuses attachment references from another workspace before native download', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    await expect(
      f.client.attachments.download({
        id: 'attachment',
        name: 'a',
        mimeType: 'text/plain',
        size: 1,
        workspaceId: 'b',
        chatId: 1,
        accountId: 'alice',
        endpoint: 'http://os.example',
      }),
    ).rejects.toMatchObject({ code: 'workspace' })
    expect(f.a.value.getChatAttachmentContent).not.toHaveBeenCalled()
    f.client.dispose()
  })
  it('does not return download bytes after sign out', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const bytes = deferred<Uint8Array>()
    f.a.value.getChatAttachmentContent.mockReturnValue(bytes.promise)
    const downloading = f.client.attachments.download({
      id: 'attachment',
      name: 'a',
      mimeType: 'text/plain',
      size: 1,
      workspaceId: 'a',
      chatId: 1,
      accountId: 'alice',
      endpoint: 'http://os.example',
    })
    f.client.auth.signOut()
    bytes.resolve(new Uint8Array([42]))
    await expect(downloading).rejects.toMatchObject({ code: 'cancelled' })
    f.client.dispose()
  })
  it('persists sessions by default without storing plaintext passwords', async () => {
    const f = setup()
    await f.client.auth.signIn({
      username: 'alice',
      password: 'private-password',
    })
    expect(sessionStorage.length).toBeGreaterThan(0)
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(
      'private-password',
    )
    f.client.dispose()
  })
  it('restores a default per-tab session and clears it on sign out', async () => {
    const f = setup()
    const first = createWispChat({
      url: 'http://os.example',
    })
    await first.auth.signIn({ username: 'alice', password: 'private-password' })
    await first.workspaces.select('a')
    await first.conversations.select(1)
    expect(sessionStorage.key(0)).toMatch(/^os-chat:/)
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(
      'private-password',
    )
    const second = createWispChat({
      url: 'http://os.example',
    })
    await second.start()
    const s = second.getSnapshot()
    expect(s.status).toBe('authenticated')
    expect(
      s.status === 'authenticated' &&
        s.workspace.status === 'ready' &&
        s.workspace.workspace.id,
    ).toBe('a')
    expect(
      s.status === 'authenticated' &&
        s.workspace.status === 'ready' &&
        s.workspace.conversation.status === 'conversation' &&
        s.workspace.conversation.id,
    ).toBe(1)
    second.auth.signOut()
    expect(sessionStorage.length).toBe(0)
    first.dispose()
    second.dispose()
    f.client.dispose()
  })
})

describe('application session handoff', () => {
  it('clears a persisted session when the app starts signed out before client startup', async () => {
    const f = setup()
    await login(f)
    f.client.dispose()
    const fresh = createWispChat({ url: 'http://os.example' })
    await fresh.auth.setSession(null)
    await fresh.start()
    expect(fresh.getSnapshot().status).toBe('signed-out')
    expect(sessionStorage.length).toBe(0)
    fresh.dispose()
  })
  it('does not fall back to a persisted account after a rejected initial handoff', async () => {
    const f = setup()
    await login(f)
    f.client.dispose()
    const fresh = createWispChat({ url: 'http://os.example' })
    await expect(
      fresh.auth.setSession({ token: 'wrong', accountId: 'bob' }),
    ).rejects.toMatchObject({ code: 'credentials' })
    expect(fresh.getSnapshot().status).toBe('signed-out')
    expect(sessionStorage.length).toBe(0)
    fresh.dispose()
  })
  it('validates the supplied token without password login and restores it after refresh', async () => {
    const f = setup()
    f.api.getServerConfig.mockResolvedValue({ passwordAuthEnabled: false })
    await f.client.auth.setSession({ token: 'app-token', accountId: 'alice' })
    expect(f.api.authenticate).toHaveBeenCalledWith('app-token')
    expect(f.api.login).not.toHaveBeenCalled()
    expect(network.hash).not.toHaveBeenCalled()
    expect(f.client.getSnapshot()).toMatchObject({
      status: 'authenticated',
      account: { id: 'alice' },
    })
    expect(JSON.stringify(f.client.getSnapshot())).not.toContain('app-token')
    f.client.dispose()
    const restored = createWispChat({ url: 'http://os.example' })
    await restored.start()
    expect(restored.getSnapshot()).toMatchObject({
      status: 'authenticated',
      account: { id: 'alice' },
    })
    await restored.auth.setSession(null)
    expect(restored.getSnapshot().status).toBe('signed-out')
    expect(sessionStorage.length).toBe(0)
    restored.dispose()
  })
  it('rejects an identity mismatch and clears the previous account and history', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    await f.client.conversations.select(1)
    await expect(
      f.client.auth.setSession({
        token: 'wrong-account-token',
        accountId: 'bob',
      }),
    ).rejects.toMatchObject({ code: 'credentials' })
    expect(f.client.getSnapshot().status).toBe('signed-out')
    expect(sessionStorage.length).toBe(0)
    expect(f.a.value[Symbol.dispose]).toHaveBeenCalled()
    f.client.dispose()
  })
  it('rejects empty or expired session tokens without persisting them', async () => {
    const f = setup()
    await expect(
      f.client.auth.setSession({ token: '', accountId: 'alice' }),
    ).rejects.toMatchObject({ code: 'credentials' })
    expect(f.api.authenticate).not.toHaveBeenCalled()
    f.api.authenticate.mockRejectedValueOnce(new Error('expired'))
    await expect(
      f.client.auth.setSession({ token: 'expired-token', accountId: 'alice' }),
    ).rejects.toMatchObject({ code: 'credentials' })
    expect(sessionStorage.length).toBe(0)
    expect(f.client.getSnapshot().status).toBe('signed-out')
    f.client.dispose()
  })
  it('keeps a cleared app session signed out when validation finishes late', async () => {
    const f = setup()
    const identity = deferred<{ id: string; name: string }>()
    f.account.whoami.mockReturnValueOnce(identity.promise)
    const pending = f.client.auth.setSession({
      token: 'app-token',
      accountId: 'alice',
    })
    await vi.waitFor(() => expect(f.account.whoami).toHaveBeenCalled())
    await f.client.auth.setSession(null)
    identity.resolve({ id: 'alice', name: 'Alice' })
    await pending
    expect(f.client.getSnapshot().status).toBe('signed-out')
    expect(sessionStorage.length).toBe(0)
    f.client.dispose()
  })
  it('keeps the latest app account when an earlier validation finishes late', async () => {
    const f = setup()
    const identity = deferred<{ id: string; name: string }>()
    f.account.whoami.mockReturnValueOnce(identity.promise)
    const first = f.client.auth.setSession({
      token: 'alice-token',
      accountId: 'alice',
    })
    await vi.waitFor(() => expect(f.account.whoami).toHaveBeenCalled())
    f.account.whoami.mockResolvedValue({ id: 'bob', name: 'Bob' })
    await f.client.auth.setSession({ token: 'bob-token', accountId: 'bob' })
    identity.resolve({ id: 'alice', name: 'Alice' })
    await first
    expect(f.client.getSnapshot()).toMatchObject({
      status: 'authenticated',
      account: { id: 'bob' },
      workspace: { status: 'none' },
    })
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('alice-token')
    f.client.dispose()
  })
})

describe('initialization races and connection recovery', () => {
  it('does not sign in after logout while public initialization is pending', async () => {
    const f = setup()
    const config = deferred<{ passwordAuthEnabled: boolean }>()
    f.api.getServerConfig.mockReturnValueOnce(config.promise)
    const signingIn = login(f)
    f.client.auth.signOut()
    config.resolve({ passwordAuthEnabled: true })
    await signingIn
    expect(f.api.login).not.toHaveBeenCalled()
    expect(f.client.getSnapshot().status).toBe('signed-out')
    f.client.dispose()
  })
  it('lets the latest sign-in request supersede an older one awaiting initialization', async () => {
    const f = setup()
    const config = deferred<{ passwordAuthEnabled: boolean }>()
    f.api.getServerConfig.mockReturnValueOnce(config.promise)
    const first = f.client.auth.signIn({ username: 'old', password: 'first' })
    const second = f.client.auth.signIn({
      username: 'alice',
      password: 'second',
    })
    config.resolve({ passwordAuthEnabled: true })
    await Promise.all([first, second])
    expect(f.api.login).toHaveBeenCalledTimes(1)
    expect(f.api.login).toHaveBeenCalledWith('alice', expect.any(Uint8Array))
    f.client.dispose()
  })
  it('reauthenticates and restores workspace history without replaying sends', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    await f.client.conversations.select(1)
    const broken = network.open.mock.calls.at(-1)?.[1]
    if (typeof broken !== 'function')
      throw new Error('Missing connection callback')
    broken()
    await vi.waitFor(() => expect(ready(f).workspace.id).toBe('a'))
    expect(f.api.authenticate.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(f.a.value.sendChatMessage).not.toHaveBeenCalled()
    expect(f.a.value.newChat).not.toHaveBeenCalled()
    f.client.dispose()
  })
})

describe('recoverable initialization failures', () => {
  it('can retry initialization after an endpoint failure', async () => {
    const f = setup()
    f.api.getServerConfig.mockRejectedValueOnce(new Error('unreachable'))
    await expect(f.client.start()).rejects.toMatchObject({ code: 'connection' })
    await f.client.start()
    expect(f.client.getSnapshot().connection).toBe('connected')
    expect(network.open).toHaveBeenCalledTimes(2)
    f.client.dispose()
  })
  it('keeps a valid identity when listing workspaces fails after login', async () => {
    const f = setup()
    f.account.listWorkspaces.mockRejectedValueOnce(
      new Error('temporary failure'),
    )
    await expect(login(f)).rejects.toMatchObject({ code: 'workspace' })
    expect(f.client.getSnapshot().status).toBe('authenticated')
    await f.client.workspaces.list()
    const s = f.client.getSnapshot()
    expect(s.status === 'authenticated' && s.workspaces.length).toBe(2)
    f.client.dispose()
  })
})

describe('pending creation cancellation and upload errors', () => {
  it('applies stop once when a pending new chat returns its id', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const creation = deferred<number>()
    f.a.value.newChat.mockReturnValue(creation.promise)
    f.a.value.listChats.mockResolvedValue([{ id: 2, title: 'New chat' }])
    const sending = f.client.conversations.send({ text: 'question' })
    await vi.waitFor(() => expect(f.a.value.newChat).toHaveBeenCalledOnce())
    await f.client.conversations.stop()
    await f.client.conversations.stop()
    creation.resolve(2)
    await sending
    expect(f.a.value.stopAgent).toHaveBeenCalledExactlyOnceWith(2)
    expect(ready(f).running).toBe(false)
    f.client.dispose()
  })
  it('does not apply a pending stop after its workspace was replaced', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const creation = deferred<number>()
    f.a.value.newChat.mockReturnValue(creation.promise)
    const sending = f.client.conversations.send({ text: 'question' })
    await vi.waitFor(() => expect(f.a.value.newChat).toHaveBeenCalledOnce())
    await f.client.conversations.stop()
    await f.client.workspaces.select('b')
    creation.resolve(2)
    await sending
    expect(f.a.value.stopAgent).not.toHaveBeenCalled()
    expect(f.b.value.stopAgent).not.toHaveBeenCalled()
    expect(ready(f).workspace.id).toBe('b')
    f.client.dispose()
  })
  it('reports upload transport failure without blaming file validation and permits retry', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const file = new File(['csv'], 'input.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode('a,b').buffer,
    })
    f.a.value.uploadBlob.mockRejectedValueOnce(new Error('offline'))
    await expect(
      f.client.conversations.send({ files: [file] }),
    ).rejects.toMatchObject({ code: 'operation' })
    expect(f.a.value.newChat).not.toHaveBeenCalled()
    expect(f.a.value.sendChatMessage).not.toHaveBeenCalled()
    await f.client.conversations.send({ files: [file] })
    expect(f.a.value.newChat).toHaveBeenCalledOnce()
    f.client.dispose()
  })
  it('keeps invalid file signatures classified as validation failures', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const file = new File(['bad'], 'input.png', { type: 'image/png' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode('bad').buffer,
    })
    await expect(
      f.client.conversations.send({ files: [file] }),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(f.a.value.uploadBlob).not.toHaveBeenCalled()
    expect(f.a.value.newChat).not.toHaveBeenCalled()
    f.client.dispose()
  })
  it('exposes buffered native conversation metadata after an uncertain creation without resending', async () => {
    const f = setup()
    await login(f)
    await f.client.workspaces.select('a')
    const creation = deferred<number>()
    f.a.value.newChat.mockReturnValue(creation.promise)
    const sending = f.client.conversations
      .send({ text: 'question' })
      .catch((error) => error)
    await vi.waitFor(() => expect(f.a.value.newChat).toHaveBeenCalledOnce())
    await f.a.subscriber.metadata({
      id: 2,
      title: 'Recover this conversation',
      activeAgent: { id: 'model' },
    })
    creation.reject(new Error('response lost'))
    expect(await sending).toMatchObject({ code: 'uncertain' })
    expect(ready(f).conversations.some((chat) => chat.id === 2)).toBe(true)
    expect(f.a.value.newChat).toHaveBeenCalledOnce()
    expect(f.a.value.sendChatMessage).not.toHaveBeenCalled()
    f.client.dispose()
  })
})

it('does not claim remote cancellation if creation fails before its id is known', async () => {
  const f = setup()
  await login(f)
  await f.client.workspaces.select('a')
  const creation = deferred<number>()
  f.a.value.newChat.mockReturnValue(creation.promise)
  const sending = f.client.conversations
    .send({ text: 'question' })
    .catch((error) => error)
  await vi.waitFor(() => expect(f.a.value.newChat).toHaveBeenCalledOnce())
  await f.client.conversations.stop()
  creation.reject(new Error('response lost'))
  expect(await sending).toMatchObject({ code: 'uncertain' })
  expect(f.a.value.stopAgent).not.toHaveBeenCalled()
  f.client.dispose()
})

it('preserves sessions on dispose and clears them only on sign out', async () => {
  const f = setup()
  const first = createWispChat({
    url: 'http://os.example',
  })
  await first.auth.signIn({ username: 'alice', password: 'private' })
  await first.workspaces.select('a')
  first.dispose()
  const second = createWispChat({
    url: 'http://os.example',
  })
  await second.start()
  expect(second.getSnapshot().status).toBe('authenticated')
  const state = second.getSnapshot()
  expect(
    state.status === 'authenticated' &&
      state.workspace.status === 'ready' &&
      state.workspace.workspace.id,
  ).toBe('a')
  second.auth.signOut()
  expect(sessionStorage.length).toBe(0)
  second.dispose()
  f.client.dispose()
})

it('keeps a stopped turn running until native idle is confirmed', async () => {
  const f = setup()
  await login(f)
  await f.client.workspaces.select('a')
  await f.client.conversations.select(1)
  f.a.value.listChats.mockResolvedValue([
    { id: 1, title: 'C', activeAgent: { id: 'model' } },
  ])
  await f.client.conversations.send({ text: 'question' })
  await f.client.conversations.stop()
  expect(ready(f).running).toBe(true)
  await expect(
    f.client.conversations.send({ text: 'next' }),
  ).rejects.toMatchObject({ code: 'operation' })
  await f.a.subscriber.metadata({ id: 1, title: 'C' })
  await vi.waitFor(() => expect(ready(f).running).toBe(false))
  f.client.dispose()
})

it('cancels an existing-chat upload without stopping or sending a native turn', async () => {
  const f = setup()
  await login(f)
  await f.client.workspaces.select('a')
  await f.client.conversations.select(1)
  const upload = deferred<string>()
  f.a.value.uploadBlob.mockReturnValue(upload.promise)
  const file = new File(['csv'], 'a.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode('a,b').buffer,
  })
  const sending = f.client.conversations
    .send({ files: [file] })
    .catch((error) => error)
  await vi.waitFor(() => expect(f.a.value.uploadBlob).toHaveBeenCalledOnce())
  await f.client.conversations.stop()
  upload.resolve('blob')
  expect(await sending).toMatchObject({ code: 'cancelled' })
  expect(f.a.value.stopAgent).not.toHaveBeenCalled()
  expect(f.a.value.sendChatMessage).not.toHaveBeenCalled()
  f.client.dispose()
})

it('stops a dispatched pending existing-chat send once and allows retry after a failed stop', async () => {
  const f = setup()
  await login(f)
  await f.client.workspaces.select('a')
  await f.client.conversations.select(1)
  const response = deferred<void>()
  f.a.value.sendChatMessage.mockReturnValue(response.promise)
  f.a.value.listChats.mockResolvedValue([
    { id: 1, title: 'C', activeAgent: { id: 'model' } },
  ])
  const sending = f.client.conversations.send({ text: 'question' })
  await vi.waitFor(() =>
    expect(f.a.value.sendChatMessage).toHaveBeenCalledOnce(),
  )
  f.a.value.stopAgent.mockRejectedValueOnce(new Error('temporary'))
  await expect(f.client.conversations.stop()).rejects.toMatchObject({
    code: 'operation',
  })
  expect(ready(f).running).toBe(true)
  await f.client.conversations.stop()
  await f.client.conversations.stop()
  expect(f.a.value.stopAgent).toHaveBeenCalledTimes(2)
  response.resolve()
  await sending
  expect(ready(f).running).toBe(true)
  await f.a.subscriber.metadata({ id: 1, title: 'C' })
  await vi.waitFor(() => expect(ready(f).running).toBe(false))
  f.client.dispose()
})
