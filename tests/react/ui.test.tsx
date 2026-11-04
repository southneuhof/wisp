import { afterEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createWispChat } from '@southneuhof/wisp-core'
import type { ChatSnapshot } from '@southneuhof/wisp-core'
import { useWispChat } from '../../packages/react/src/index.js'
import { WispChat } from '../../packages/react-ui/src/WispChat.js'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  sessionStorage.clear()
})
function fixture(authenticated = true) {
  const client = createWispChat({ url: 'http://os.example' })
  const state: ChatSnapshot = authenticated
    ? {
        status: 'authenticated',
        connection: 'connected',
        error: null,
        account: { id: 'alice', name: 'Alice' },
        workspaces: [
          { id: 'a', title: 'Workspace A', role: 'build' },
          { id: 'b', title: 'Workspace B', role: 'build' },
        ],
        workspace: {
          status: 'ready',
          workspace: { id: 'a', title: 'Workspace A', role: 'build' },
          models: [
            { id: 'one', name: 'Model One' },
            { id: 'two', name: 'Model Two' },
          ],
          modelId: 'one',
          conversations: [{ id: 1, title: 'Earlier chat', running: false }],
          conversation: { status: 'draft', messages: [] },
          running: false,
          uploading: false,
          loadingEarlier: false,
          hasEarlier: false,
        },
      }
    : {
        status: 'signed-out',
        connection: 'connected',
        error: null,
        passwordAuthEnabled: true,
      }
  return { client, chat: { client, state, url: 'http://os.example' } }
}
async function open(chat: ReturnType<typeof fixture>['chat']) {
  const view = render(<WispChat chat={chat} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
  return view
}
describe('React UI', () => {
  it('signs in with user credentials and immediately clears the password', async () => {
    const f = fixture(false)
    const signIn = vi.spyOn(f.client.auth, 'signIn').mockResolvedValue()
    await open(f.chat)
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'alice' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'private' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(signIn).toHaveBeenCalledWith({
      username: 'alice',
      password: 'private',
    })
    expect(screen.getByLabelText<HTMLInputElement>('Password').value).toBe('')
    f.client.dispose()
  })
  it('selects models through Base UI without closing the chat', async () => {
    const f = fixture()
    const select = vi
      .spyOn(f.client.models, 'select')
      .mockImplementation(() => {})
    await open(f.chat)
    await userEvent.click(screen.getByRole('button', { name: 'Model' }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Model Two' }),
    )
    expect(select).toHaveBeenCalledWith('two')
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeTruthy()
    f.client.dispose()
  })
  it('starts a new conversation through the pinned menu footer', async () => {
    const f = fixture()
    const start = vi
      .spyOn(f.client.conversations, 'startNew')
      .mockImplementation(() => {})
    vi.spyOn(f.client.conversations, 'list').mockResolvedValue([])
    await open(f.chat)
    await userEvent.click(
      screen.getByRole('button', { name: 'Select conversation' }),
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'New conversation' }),
    )
    expect(start).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeTruthy()
    f.client.dispose()
  })
  it('opens the nested workspace menu and selects without closing chat', async () => {
    const f = fixture()
    const select = vi.spyOn(f.client.workspaces, 'select').mockResolvedValue()
    await open(f.chat)
    await userEvent.click(screen.getByRole('button', { name: 'Chat settings' }))
    await userEvent.hover(
      await screen.findByRole('menuitem', { name: 'Workspace A' }),
    )
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Workspace B' }),
    )
    expect(select).toHaveBeenCalledWith('b')
    expect(screen.getByRole('button', { name: 'Close chat' })).toBeTruthy()
    f.client.dispose()
  })
  it('keeps the composer draft while closing and reopening', async () => {
    const f = fixture()
    await open(f.chat)
    fireEvent.change(screen.getByPlaceholderText('Ask me anything…'), {
      target: { value: 'Unsent question' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Close chat' }))
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Ask me anything…')).toBeNull(),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(
      screen.getByPlaceholderText<HTMLTextAreaElement>('Ask me anything…')
        .value,
    ).toBe('Unsent question')
    f.client.dispose()
  })
  it('sends a question through the shared core client', async () => {
    const f = fixture()
    const send = vi.spyOn(f.client.conversations, 'send').mockResolvedValue()
    await open(f.chat)
    fireEvent.change(screen.getByPlaceholderText('Ask me anything…'), {
      target: { value: 'How is traffic?' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ text: 'How is traffic?', files: [] }),
    )
    f.client.dispose()
  })
  it('stages a dropped file and sends the original File without text', async () => {
    const f = fixture()
    const send = vi.spyOn(f.client.conversations, 'send').mockResolvedValue()
    await open(f.chat)
    const file = new File(['report'], 'report.txt', { type: 'text/plain' })
    const composer = document.querySelector('.wisp-composer')
    if (!composer) throw new Error('Missing composer')
    fireEvent.drop(composer, {
      dataTransfer: { files: [file], types: ['Files'] },
    })
    await screen.findByText('report.txt')
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ text: '', files: [file] }),
    )
    f.client.dispose()
  })
  it('renders streamed messages while retaining the draft and exposes cancellation', async () => {
    const f = fixture()
    const stop = vi.spyOn(f.client.conversations, 'stop').mockResolvedValue()
    const view = await open(f.chat)
    fireEvent.change(screen.getByPlaceholderText('Ask me anything…'), {
      target: { value: 'Next question' },
    })
    const state = f.chat.state
    if (state.status !== 'authenticated' || state.workspace.status !== 'ready')
      throw new Error('Expected ready workspace')
    view.rerender(
      <WispChat
        chat={{
          ...f.chat,
          state: {
            ...state,
            workspace: {
              ...state.workspace,
              running: true,
              conversation: {
                status: 'conversation',
                id: 1,
                messages: [
                  {
                    id: 'answer',
                    role: 'assistant',
                    text: 'Streaming answer',
                    status: 'running',
                    attachments: [],
                  },
                ],
              },
            },
          },
        }}
      />,
    )
    await screen.findByText('Streaming answer')
    // Moving to a different conversation intentionally clears private drafts.
    fireEvent.change(screen.getByPlaceholderText('Ask me anything…'), {
      target: { value: 'Follow-up' },
    })
    view.rerender(
      <WispChat
        chat={{
          ...f.chat,
          state: {
            ...state,
            workspace: {
              ...state.workspace,
              running: true,
              conversation: {
                status: 'conversation',
                id: 1,
                messages: [
                  {
                    id: 'answer',
                    role: 'assistant',
                    text: 'Streaming answer continues',
                    status: 'running',
                    attachments: [],
                  },
                ],
              },
            },
          },
        }}
      />,
    )
    await screen.findByText('Streaming answer continues')
    expect(
      screen.getByPlaceholderText<HTMLTextAreaElement>('Ask me anything…')
        .value,
    ).toBe('Follow-up')
    await userEvent.click(
      screen.getByRole('button', { name: 'Stop Assistant' }),
    )
    expect(stop).toHaveBeenCalledOnce()
    f.client.dispose()
  })
  it('cleans up its client after a real unmount while surviving Strict Mode replay', async () => {
    const started = vi
      .spyOn(
        Object.getPrototypeOf(createWispChat({ url: 'http://os.example' })),
        'start',
      )
      .mockResolvedValue(undefined)
    let current: ReturnType<typeof useWispChat> | undefined
    function Host() {
      current = useWispChat({ url: 'http://os.example' })
      return <span>{current.state.status}</span>
    }
    const view = render(
      <StrictMode>
        <Host />
      </StrictMode>,
    )
    await Promise.resolve()
    expect(current?.client.getSnapshot().status).not.toBe('disposed')
    view.unmount()
    await Promise.resolve()
    expect(current?.client.getSnapshot().status).toBe('disposed')
    expect(started).toHaveBeenCalled()
  })
})
