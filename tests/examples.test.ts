/// <reference types="vite/client" />
import { expect, it, vi } from 'vitest'
import { createWispChat } from '@southneuhof/wisp-core'
import type { ChatSnapshot } from '@southneuhof/wisp-core'

it('keeps a vanilla composer focused during streaming, accepts files alone, and clears private drafts across scopes', async () => {
  const client = createWispChat({ url: 'http://os.example' })
  let snapshot: ChatSnapshot = {
    status: 'authenticated',
    connection: 'connected',
    error: null,
    account: { id: 'alice', name: 'Alice' },
    workspaces: [{ id: 'a', title: 'A', role: 'build' }],
    workspace: {
      status: 'ready',
      workspace: { id: 'a', title: 'A', role: 'build' },
      models: [{ id: 'm', name: 'Model' }],
      modelId: 'm',
      conversations: [],
      conversation: { status: 'draft', messages: [] },
      running: false,
      uploading: false,
      loadingEarlier: false,
      hasEarlier: false,
    },
  }
  let publish: (state: ChatSnapshot) => void = () => {}
  vi.spyOn(client, 'subscribe').mockImplementation((listener) => {
    publish = listener
    listener(snapshot)
    return () => {}
  })
  vi.spyOn(client, 'getSnapshot').mockImplementation(() => snapshot)
  vi.spyOn(client, 'start').mockResolvedValue()
  const send = vi.spyOn(client.conversations, 'send').mockResolvedValue()
  vi.doMock('@southneuhof/wisp-core', () => ({ createWispChat: () => client }))
  document.body.innerHTML = '<div id="app"></div>'
  await import('../examples/vanilla/main')
  const textarea = document.querySelector('textarea')
  const files = document.querySelector('input[type="file"]')
  if (
    !(textarea instanceof HTMLTextAreaElement) ||
    !(files instanceof HTMLInputElement)
  )
    throw new Error('Missing composer')
  try {
    textarea.value = 'private draft'
    textarea.dispatchEvent(new Event('input'))
    textarea.focus()
    textarea.setSelectionRange(3, 6)
    publish(snapshot)
    expect(document.activeElement).toBe(textarea)
    expect(textarea.selectionStart).toBe(3)
    expect(textarea.selectionEnd).toBe(6)
    const file = new File(['data'], 'report.csv')
    Object.defineProperty(files, 'files', { configurable: true, value: [file] })
    textarea.value = ''
    files.dispatchEvent(new Event('change'))
    textarea.form?.dispatchEvent(new Event('submit', { cancelable: true }))
    expect(send).toHaveBeenCalledWith({ text: '', files: [file] })
    textarea.value = 'another private draft'
    if (
      snapshot.status !== 'authenticated' ||
      snapshot.workspace.status !== 'ready'
    )
      throw new Error('Missing workspace')
    snapshot = {
      ...snapshot,
      workspace: {
        ...snapshot.workspace,
        workspace: { id: 'b', title: 'B', role: 'build' },
      },
    }
    publish(snapshot)
    expect(textarea.value).toBe('')
    textarea.value = 'account private draft'
    snapshot = { ...snapshot, account: { id: 'bob', name: 'Bob' } }
    publish(snapshot)
    expect(textarea.value).toBe('')
    textarea.value = 'logout private draft'
    snapshot = {
      status: 'signed-out',
      connection: 'offline',
      error: null,
      passwordAuthEnabled: true,
    }
    publish(snapshot)
    expect(textarea.value).toBe('')
  } finally {
    window.dispatchEvent(new Event('pagehide'))
    vi.doUnmock('@southneuhof/wisp-core')
    vi.restoreAllMocks()
    document.body.replaceChildren()
  }
})
