'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from '@assistant-ui/react'
import type {
  AppendMessage,
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from '@assistant-ui/react'
import type { Conversation, WorkspaceState } from '@southneuhof/wisp-core'
import type { WispChatBinding } from '@southneuhof/wisp-react'
import {
  ChatConversationPicker,
  ChatModelPicker,
  ChatOptionsMenu,
} from './menus.js'
import {
  ChatIconButton,
  ChatSpinner,
  MessagesContext,
  Transition,
} from './primitives.js'
import { ChatIcon } from './ChatIcon.js'
import { ChatSignIn } from './ChatSignIn.js'
import {
  ChatAttachmentPreview,
  ChatMessage,
  DownloadContext,
} from './ChatMessage.js'
import { defaultMessages } from './messages.js'
import type { ChatMessages, ChatErrorMessages } from './messages.js'
import type { WispChatTheme } from './theme.js'
import type { WispChatActions } from './actions.js'
import { useChatTheme } from './useChatTheme.js'
import { toThreadMessage } from './runtime/conversation.js'
import type {
  ConversationMessage,
  NativeAttachmentDisplayData,
} from './runtime/conversation.js'
import {
  canonicalMimeType,
  validateChatDraft,
} from './runtime/attachmentValidation.js'
export interface WispChatRenderContext {
  account:
    | Extract<WispChatBinding['state'], { status: 'authenticated' }>['account']
    | null
  workspaces: Extract<
    WispChatBinding['state'],
    { status: 'authenticated' }
  >['workspaces']
  workspace: WorkspaceState | null
  snapshot: WispChatBinding['state']
  busy: boolean
  actions: WispChatActions
}
export interface WispChatProps {
  chat: WispChatBinding
  theme?: Partial<WispChatTheme>
  title?: string
  messages?: Partial<ChatMessages>
  errors?: ChatErrorMessages
  header?: (context: WispChatRenderContext) => ReactNode
  controls?: (context: WispChatRenderContext) => ReactNode
  emptyState?: ReactNode
  message?: () => ReactNode
  composerActions?: (chat: WispChatBinding) => ReactNode
}
function workspaceId(state: WorkspaceState | null): string {
  return !state || state.status === 'none'
    ? ''
    : state.status === 'opening'
      ? state.id
      : state.workspace.id
}
function attachmentType(mime: string): PendingAttachment['type'] {
  return mime.startsWith('image/')
    ? 'image'
    : mime.startsWith('text/') ||
        mime === 'application/pdf' ||
        mime === 'application/json'
      ? 'document'
      : 'file'
}
function ComposerAttachment() {
  return (
    <div className="wisp-mb-2 wisp-min-w-[180px] wisp-max-w-full wisp-rounded-xl wisp-bg-surface-container-high/70 wisp-p-2 wisp-text-on-surface wisp-shadow-sm">
      <ChatAttachmentPreview removable />
    </div>
  )
}
export function WispChat(p: WispChatProps) {
  const { chat } = p,
    snapshot = chat.state,
    client = chat.client
  const t = useMemo(
      () => ({ ...defaultMessages, ...p.messages }),
      [p.messages],
    ),
    themeStyle = useChatTheme(p.theme)
  const account = snapshot.status === 'authenticated' ? snapshot.account : null
  const workspaces =
    snapshot.status === 'authenticated' ? snapshot.workspaces : []
  const workspaceState =
    snapshot.status === 'authenticated' ? snapshot.workspace : null
  const workspace = workspaceState?.status === 'ready' ? workspaceState : null
  const [open, setOpen] = useState(false),
    [busyAction, setBusyAction] = useState(false),
    [sending, setSending] = useState(false),
    [error, setError] = useState(''),
    [loadingList, setLoadingList] = useState(false),
    [listError, setListError] = useState(''),
    [loadingId, setLoadingId] = useState<number | null>(null),
    [scrolled, setScrolled] = useState(false),
    [retry, setRetry] = useState<{ text: string; files: File[] }>()
  const floating = useRef<HTMLDivElement>(null),
    launcher = useRef<HTMLButtonElement>(null),
    draftFiles = useRef(new Map<string, File>()),
    autoSelecting = useRef(false),
    downloadUrls = useRef(new Map<string, ReturnType<typeof setTimeout>>()),
    scroll = useRef<{ top: number | null; bottom: boolean }>({
      top: null,
      bottom: true,
    }),
    focusPending = useRef(false)
  const connecting =
    snapshot.status === 'starting' ||
    snapshot.status === 'signing-in' ||
    snapshot.connection === 'recovering' ||
    workspaceState?.status === 'opening'
  const ready = !!workspace && snapshot.connection === 'connected'
  const busy =
    busyAction || sending || !!workspace?.running || !!workspace?.uploading
  const selectedId =
    workspace?.conversation.status === 'draft'
      ? null
      : (workspace?.conversation.id ?? null)
  const selectedModel = workspace?.modelId ?? ''
  const title =
    selectedId === null
      ? t.newConversation
      : workspace?.conversations.find((c) => c.id === selectedId)?.title ||
        `Conversation ${selectedId}`
  const modelKey =
    account && workspace
      ? `os-chat:model:${chat.url}:${account.id}:${workspace.workspace.id}`
      : ''
  const showThinking =
    !!workspace?.running &&
    (!workspace.conversation.messages.length ||
      workspace.conversation.messages.at(-1)?.role === 'user')
  const messages = useMemo<ConversationMessage[]>(
    () =>
      (workspace?.conversation.messages ?? []).map((m, i) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        status:
          m.status === 'running'
            ? { type: 'running' }
            : m.status === 'complete'
              ? { type: 'complete' }
              : {
                  type: 'incomplete',
                  reason: m.status === 'cancelled' ? 'cancelled' : 'error',
                },
        attachments: m.attachments.map((a) => ({
          id: a.id,
          name: a.name,
          mimeType: a.mimeType,
          size: a.size,
          source: { kind: 'history', chatId: a.chatId, attachmentId: a.id },
        })),
        sequence: m.sequence,
        order: m.sequence ?? i,
      })),
    [workspace?.conversation.messages],
  )
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusyAction(true)
    setError('')
    try {
      await action()
      return true
    } catch {
      setError(message)
      return false
    } finally {
      setBusyAction(false)
    }
  }
  useEffect(() => {
    if (
      !account ||
      busyAction ||
      autoSelecting.current ||
      workspaceState?.status !== 'none' ||
      !workspaces[0]
    )
      return
    autoSelecting.current = true
    void run(
      () => client.workspaces.select(workspaces[0]!.id),
      'The default workspace could not be opened. Choose a workspace from Chat settings.',
    ).finally(() => {
      autoSelecting.current = false
    })
  }, [account, workspaces, workspaceState, busyAction, client])
  useEffect(() => {
    if (!modelKey || !workspace) return
    try {
      const saved = localStorage.getItem(modelKey)
      if (
        saved &&
        workspace.models.some((m) => m.id === saved) &&
        saved !== workspace.modelId
      )
        client.models.select(saved)
    } catch {}
  }, [modelKey, client])
  const attachmentAdapter = useMemo<AttachmentAdapter>(
    () => ({
      accept: '*',
      async add({ file }): Promise<PendingAttachment> {
        if (!ready || busy || !selectedModel)
          throw new Error('Chat is unavailable.')
        const invalid = validateChatDraft('x', [
          ...draftFiles.current.values(),
          file,
        ])
        if (invalid) {
          setError(invalid)
          throw new Error(invalid)
        }
        const id = crypto.randomUUID()
        draftFiles.current.set(id, file)
        return {
          id,
          type: attachmentType(canonicalMimeType(file)),
          name: file.name,
          contentType: canonicalMimeType(file),
          file,
          status: { type: 'requires-action', reason: 'composer-send' },
        }
      },
      async remove(a) {
        draftFiles.current.delete(a.id)
      },
      async send(a, options): Promise<CompleteAttachment> {
        if (options?.signal?.aborted)
          throw new DOMException('Upload cancelled', 'AbortError')
        return {
          ...a,
          status: { type: 'complete' },
          content: [
            {
              type: 'data',
              name: 'wisp-native',
              data: {
                kind: 'native',
                mimeType: canonicalMimeType(a.file),
                name: a.name,
              },
            },
          ],
        }
      },
    }),
    [ready, busy, selectedModel],
  )
  const onNew = async (message: AppendMessage) => {
    if (!ready || busy) return
    const text = message.content
      .flatMap((part) => (part.type === 'text' ? [part.text] : []))
      .join('')
      .trim()
    const files = (message.attachments ?? []).flatMap((a) => {
      const file = draftFiles.current.get(a.id) ?? a.file
      return file ? [file] : []
    })
    const invalid = validateChatDraft(text, files)
    if (invalid) {
      setError(invalid)
      return
    }
    setRetry({ text, files })
    setError('')
    setSending(true)
    try {
      await client.conversations.send({ text, files })
      setRetry(undefined)
    } catch {
      setError(
        'Assistant could not finish the response. Try sending your question again.',
      )
    } finally {
      for (const a of message.attachments ?? []) draftFiles.current.delete(a.id)
      setSending(false)
    }
  }
  const onCancel = async () => {
    try {
      await client.conversations.stop()
    } catch {
      setError('Assistant could not be stopped. Try again.')
    }
  }
  const onLoadEarlier = async () => {
    try {
      await client.conversations.loadEarlier()
    } catch {
      setError('Earlier messages could not be loaded.')
    }
  }
  const runtime = useExternalStoreRuntime({
    messages,
    convertMessage: toThreadMessage,
    isLoading: connecting,
    isRunning: !!workspace?.running,
    isDisabled: !ready || busyAction || !selectedModel,
    isSendDisabled: !ready || busy || !selectedModel,
    hasEarlier: workspace?.hasEarlier ?? false,
    onLoadEarlier,
    onNew,
    onCancel,
    adapters: { attachments: attachmentAdapter },
  })
  const scopeKey = `${account?.id ?? ''}:${workspaceId(workspaceState)}:${selectedId ?? 'draft'}`
  useEffect(() => {
    draftFiles.current.clear()
    scroll.current = { top: null, bottom: true }
    setScrolled(false)
    void runtime.thread.composer.reset()
  }, [scopeKey, runtime])
  const close = useCallback((restoreFocus = true) => {
    const viewport = floating.current?.querySelector('.wisp-thread-fade')
    if (viewport)
      scroll.current = {
        top: viewport.scrollTop,
        bottom:
          viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <=
          1,
      }
    setOpen(false)
    focusPending.current = false
    if (restoreFocus) requestAnimationFrame(() => launcher.current?.focus())
  }, [])
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (
        !open ||
        !(e.target instanceof Node) ||
        floating.current?.contains(e.target) ||
        (e.target instanceof Element && e.target.closest('.wisp-menu-content'))
      )
        return
      close(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, close])
  useEffect(() => {
    if (floating.current) floating.current.inert = !open
  }, [open])
  useEffect(() => {
    if (!open || !ready) return
    const frame = requestAnimationFrame(() => {
      const input =
        floating.current?.querySelector<HTMLTextAreaElement>(
          '[data-wisp-input]',
        )
      if (focusPending.current && input && !input.disabled) {
        input.focus()
        focusPending.current = false
      }
      const viewport = floating.current?.querySelector('.wisp-thread-fade')
      if (viewport && scroll.current.top !== null)
        viewport.scrollTop = scroll.current.bottom
          ? viewport.scrollHeight
          : scroll.current.top
    })
    return () => cancelAnimationFrame(frame)
  }, [open, ready, busy])
  useEffect(
    () => () => {
      for (const [url, timer] of downloadUrls.current) {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
      }
      downloadUrls.current.clear()
    },
    [],
  )
  const download = async (data: NativeAttachmentDisplayData) => {
    const a = workspace?.conversation.messages
      .flatMap((m) => m.attachments)
      .find((a) => a.chatId === data.chatId && a.id === data.attachmentId)
    if (!a) return
    try {
      const blob = await client.attachments.download(a)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = data.name
      document.body.append(link)
      link.click()
      link.remove()
      downloadUrls.current.set(
        url,
        setTimeout(() => {
          URL.revokeObjectURL(url)
          downloadUrls.current.delete(url)
        }, 1000),
      )
    } catch {
      setError('This attachment could not be downloaded.')
    }
  }
  const loadConversations = async () => {
    if (!workspace || loadingList) return
    setLoadingList(true)
    setListError('')
    try {
      await client.conversations.list()
    } catch {
      setListError('Conversations could not be loaded.')
    } finally {
      setLoadingList(false)
    }
  }
  const selectConversation = async (c: Conversation) => {
    if (busy || loadingId !== null) return
    setLoadingId(c.id)
    setError('')
    try {
      await client.conversations.select(c.id)
      setRetry(undefined)
      await runtime.thread.composer.reset()
    } catch {
      setError('This conversation could not be opened.')
    } finally {
      setLoadingId(null)
    }
  }
  const actions: WispChatActions = {
    signOut() {
      if (busy) return
      client.auth.signOut()
      setRetry(undefined)
      setError('')
    },
    selectWorkspace: async (id) => {
      if (busyAction) return
      await run(async () => {
        await client.workspaces.select(id)
        setRetry(undefined)
        await runtime.thread.composer.reset()
      }, 'This workspace could not be opened.')
    },
    selectModel(id) {
      if (busy) return
      try {
        client.models.select(id)
        if (modelKey) localStorage.setItem(modelKey, id)
      } catch {
        setError('Select an available chat model.')
      }
    },
    startNewConversation() {
      if (!workspace || busy) return
      client.conversations.startNew()
      setRetry(undefined)
      setError('')
      void runtime.thread.composer.reset()
    },
    refreshWorkspaces: async () => {
      await client.workspaces.list()
    },
    createWorkspace: async (title) => {
      await run(
        () => client.workspaces.create({ title: title?.trim() || undefined }),
        'The workspace could not be created.',
      )
    },
    selectConversation: async (id) => {
      const c = workspace?.conversations.find((c) => c.id === id)
      if (c) await selectConversation(c)
    },
  }
  const context: WispChatRenderContext = {
    account,
    workspaces,
    workspace: workspaceState,
    snapshot,
    busy,
    actions,
  }
  const Message = p.message ?? ChatMessage
  const connectionError = snapshot.error
    ? (p.errors?.[snapshot.error.code] ?? snapshot.error.message)
    : workspaceState?.status === 'unavailable'
      ? 'This workspace is unavailable. Choose another workspace or try again.'
      : 'CloudflareOS is unavailable. Check your connection and try again.'
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <DownloadContext.Provider value={download}>
        <MessagesContext.Provider value={t}>
          <ThreadPrimitive.Root className="wisp-ui" style={themeStyle}>
            <Transition show={!open} name="wisp-launcher">
              <button
                ref={launcher}
                type="button"
                aria-label={t.openChat}
                aria-expanded={open}
                onClick={() => {
                  focusPending.current = true
                  setOpen(true)
                }}
                className="wisp-fixed wisp-bottom-5 wisp-left-1/2 wisp-z-30 wisp-flex -wisp-translate-x-1/2 wisp-items-center wisp-gap-2 wisp-rounded-full wisp-bg-primary wisp-px-3 wisp-py-2 wisp-text-on-primary wisp-shadow-lg wisp-transition hover:wisp-brightness-110 focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary focus-visible:wisp-ring-offset-2"
              >
                <span className="wisp-text-[11px] wisp-font-semibold wisp-tracking-wide">
                  {p.title || t.openChat}
                </span>
              </button>
            </Transition>
            <div
              ref={floating}
              className={`wisp-floating wisp-pointer-events-none wisp-fixed wisp-inset-x-0 wisp-bottom-0 wisp-z-30 wisp-flex wisp-max-h-[calc(100dvh-16px)] wisp-flex-col wisp-items-center wisp-px-4 ${open ? 'wisp-floating-open' : ''}`}
              style={{
                paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
              }}
              aria-hidden={!open}
            >
              <div className="wisp-history wisp-pointer-events-auto wisp-relative wisp-mb-0 wisp-flex wisp-h-auto wisp-min-h-16 wisp-w-full wisp-max-w-[680px] wisp-shrink-0 wisp-flex-col">
                <div aria-hidden="true" className="wisp-backdrop" />
                <div aria-hidden="true" className="wisp-backdrop-extra" />
                <Transition show={open}>
                  <div className="wisp-header wisp-pointer-events-auto wisp-relative wisp-z-30 wisp-mb-2 wisp-flex wisp-min-h-10 wisp-w-full wisp-shrink-0 wisp-items-center wisp-justify-between wisp-gap-2">
                    {p.header ? (
                      p.header(context)
                    ) : (
                      <>
                        <div className="wisp-header-left wisp-flex wisp-min-w-0 wisp-items-center wisp-gap-2">
                          {ready && workspace && (
                            <ChatConversationPicker
                              title={title}
                              conversations={workspace.conversations}
                              selectedId={selectedId}
                              loading={loadingId !== null}
                              busy={busy}
                              error={listError}
                              loadingList={loadingList}
                              themeStyle={themeStyle}
                              onOpen={(v) => {
                                if (v) void loadConversations()
                              }}
                              onSelect={(c) => void selectConversation(c)}
                              onNew={actions.startNewConversation}
                              onRetry={() => void loadConversations()}
                            />
                          )}
                        </div>
                        <div className="wisp-header-right wisp-flex wisp-shrink-0 wisp-items-center wisp-gap-1">
                          <ChatOptionsMenu
                            account={account}
                            workspaces={workspaces}
                            workspaceId={workspaceId(workspaceState)}
                            busy={busy}
                            endpoint={chat.url}
                            themeStyle={themeStyle}
                            createWorkspace={(title) =>
                              run(
                                () =>
                                  client.workspaces.create({
                                    title: title.trim() || undefined,
                                  }),
                                'The workspace could not be created.',
                              )
                            }
                            onWorkspace={(id) =>
                              void actions.selectWorkspace(id)
                            }
                            onSignOut={actions.signOut}
                          />
                          <ChatIconButton
                            label="Close chat"
                            icon="close"
                            onClick={() => close()}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </Transition>
                <Transition show={open}>
                  <div
                    aria-label="Chat with assistant"
                    className="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-flex wisp-h-auto wisp-min-h-0 wisp-w-full wisp-flex-col wisp-justify-end"
                  >
                    {!account ? (
                      connecting ? (
                        <div
                          role="status"
                          className="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-mx-auto wisp-flex wisp-min-h-[320px] wisp-w-full wisp-max-w-[680px] wisp-items-center wisp-justify-center wisp-px-4 wisp-py-6 wisp-text-sm wisp-text-on-surface-variant"
                        >
                          <ChatSpinner className="wisp-mr-2 wisp-inline-block" />
                          Connecting to CloudflareOS...
                        </div>
                      ) : (
                        <ChatSignIn
                          busy={busyAction}
                          error={error || snapshot.error?.message || ''}
                          onSubmit={(input) => {
                            void run(
                              () => client.auth.signIn(input),
                              'Sign-in failed. Check your username and password.',
                            )
                          }}
                        />
                      )
                    ) : workspaceState?.status === 'unavailable' ||
                      snapshot.connection === 'offline' ? (
                      <div
                        role="alert"
                        className="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-mx-auto wisp-w-full wisp-max-w-[680px] wisp-px-4 wisp-py-5"
                      >
                        <div className="wisp-w-full wisp-rounded-2xl wisp-border wisp-border-outline-variant wisp-p-4 wisp-text-sm wisp-text-on-surface wisp-shadow-sm">
                          {connectionError}
                        </div>
                      </div>
                    ) : !workspace &&
                      (connecting || busyAction || workspaces.length > 0) ? (
                      <div
                        role="status"
                        className="wisp-flex wisp-items-center wisp-justify-center wisp-gap-2 wisp-py-4 wisp-text-sm wisp-text-on-surface-variant"
                      >
                        <ChatSpinner />
                        {t.loading}
                      </div>
                    ) : workspaceState?.status === 'none' ? (
                      <div className="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-mx-auto wisp-flex wisp-min-h-[320px] wisp-w-full wisp-max-w-[680px] wisp-items-center wisp-justify-center wisp-px-6 wisp-py-8 wisp-text-center wisp-text-sm wisp-text-on-surface-variant">
                        Select a workspace from Chat settings to start a
                        conversation.
                      </div>
                    ) : null}
                    {p.controls?.(context)}
                    {workspace && !workspace.models.length && (
                      <p className="wisp-px-4 wisp-py-3 wisp-text-sm wisp-text-error">
                        {t.noModels}
                      </p>
                    )}
                    {ready && !messages.length && !showThinking && p.emptyState}
                    {ready && (messages.length > 0 || showThinking) && (
                      <ThreadPrimitive.Viewport
                        className={`wisp-thread-fade wisp-relative wisp-z-10 wisp-min-h-0 wisp-overflow-y-auto wisp-overscroll-contain wisp-px-1 ${scrolled ? 'wisp-thread-scrolled' : ''}`}
                        autoScroll={scroll.current.bottom}
                        scrollToBottomOnInitialize={scroll.current.top === null}
                        onScroll={(e) => {
                          const v = e.currentTarget
                          scroll.current = {
                            top: v.scrollTop,
                            bottom:
                              v.scrollHeight - v.clientHeight - v.scrollTop <=
                              1,
                          }
                          setScrolled(v.scrollTop > 1)
                        }}
                      >
                        <div className="wisp-flex wisp-flex-col wisp-justify-end wisp-pb-8 wisp-pt-2">
                          {workspace?.hasEarlier && (
                            <div className="wisp-py-2 wisp-text-center">
                              <button
                                type="button"
                                disabled={workspace.loadingEarlier}
                                onClick={() => void onLoadEarlier()}
                                className="wisp-rounded-full wisp-px-3 wisp-py-1 wisp-text-xs wisp-text-on-surface-variant hover:wisp-bg-on-surface/8 disabled:wisp-opacity-50"
                              >
                                {workspace.loadingEarlier
                                  ? 'Loading...'
                                  : t.earlier}
                              </button>
                            </div>
                          )}
                          <ThreadPrimitive.Messages components={{ Message }} />
                          {showThinking && (
                            <div
                              className="wisp-mb-2 wisp-flex wisp-w-full wisp-justify-start"
                              role="status"
                              aria-live="polite"
                              aria-label="Assistant is thinking"
                            >
                              <div
                                className="wisp-flex wisp-items-center wisp-gap-1.5 wisp-rounded-2xl wisp-bg-surface-container-high/80 wisp-px-4 wisp-py-3 wisp-text-on-surface-variant wisp-shadow-sm"
                                aria-hidden="true"
                              >
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    className="wisp-h-1.5 wisp-w-1.5 wisp-animate-bounce wisp-rounded-full wisp-bg-on-surface-variant/70"
                                    style={{
                                      animationDelay: `${(i - 2) * 120}ms`,
                                    }}
                                  />
                                ))}
                              </div>
                              <span className="wisp-sr-only">
                                Assistant is thinking
                              </span>
                            </div>
                          )}
                        </div>
                      </ThreadPrimitive.Viewport>
                    )}
                  </div>
                </Transition>
                <div
                  aria-hidden="true"
                  className={`wisp-message-blur ${open && ready && scrolled ? 'wisp-blur-visible' : ''}`}
                />
              </div>
              <Transition show={open && !!workspace}>
                <ComposerPrimitive.AttachmentDropzone
                  className="wisp-composer wisp-pointer-events-auto wisp-relative wisp-z-30 -wisp-mt-5 wisp-w-full wisp-max-w-[680px] wisp-shrink-0 wisp-rounded-3xl wisp-bg-surface-container-high wisp-text-on-surface wisp-shadow-lg"
                  disabled={!ready || busy || !selectedModel}
                >
                  <ComposerPrimitive.Root className="wisp-relative wisp-z-10">
                    {error && (
                      <div
                        role="alert"
                        className="wisp-px-3 wisp-py-2 wisp-text-xs wisp-text-error"
                      >
                        {error}
                        {retry && (
                          <button
                            type="button"
                            disabled={busy}
                            className="wisp-ml-2 wisp-underline"
                            onClick={() => {
                              setSending(true)
                              setError('')
                              void client.conversations
                                .send(retry)
                                .then(() => setRetry(undefined))
                                .catch(() =>
                                  setError(
                                    'Assistant could not finish the response. Try sending your question again.',
                                  ),
                                )
                                .finally(() => setSending(false))
                            }}
                          >
                            Try again
                          </button>
                        )}
                      </div>
                    )}
                    <div className="wisp-flex wisp-flex-wrap wisp-gap-2 wisp-px-2">
                      <ComposerPrimitive.Attachments
                        components={{ Attachment: ComposerAttachment }}
                      />
                    </div>
                    <div className="wisp-rounded-xl wisp-p-2">
                      <ComposerPrimitive.Input
                        minRows={2}
                        data-wisp-input
                        className="wisp-max-h-36 wisp-min-h-11 wisp-w-full wisp-min-w-0 wisp-resize-y wisp-bg-transparent wisp-px-1 wisp-py-2 wisp-text-sm wisp-text-on-surface wisp-outline-none placeholder:wisp-text-on-surface-variant/80"
                        placeholder="Ask me anything…"
                        disabled={!ready || busy || !selectedModel}
                      />
                      <div className="wisp-flex wisp-items-center wisp-gap-2 wisp-pt-1">
                        <ComposerPrimitive.AddAttachment
                          className="wisp-flex wisp-h-9 wisp-w-9 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-full wisp-text-on-surface-variant wisp-transition hover:wisp-bg-on-surface/10 focus-visible:wisp-outline-none disabled:wisp-opacity-40"
                          aria-label="Add attachment"
                          title="Add attachment"
                        >
                          <ChatIcon size={20} name="attach_file" />
                        </ComposerPrimitive.AddAttachment>
                        <ChatModelPicker
                          models={workspace?.models ?? []}
                          selectedId={selectedModel}
                          name={
                            workspace?.models.find(
                              (m) => m.id === selectedModel,
                            )?.name ?? 'Select model'
                          }
                          busy={busy}
                          themeStyle={themeStyle}
                          onSelect={actions.selectModel}
                        />
                        {p.composerActions?.(chat)}
                        <div className="wisp-flex-1" />
                        {workspace?.uploading || workspace?.running ? (
                          <ComposerPrimitive.Cancel
                            aria-label="Stop Assistant"
                            className="wisp-flex wisp-h-9 wisp-w-9 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-full wisp-bg-error/15 wisp-text-error wisp-transition hover:wisp-bg-error/25 focus-visible:wisp-outline-none"
                          >
                            <ChatIcon size={18} name="stop" />
                          </ComposerPrimitive.Cancel>
                        ) : (
                          <ComposerPrimitive.Send
                            className="wisp-flex wisp-h-9 wisp-w-9 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-full wisp-bg-primary wisp-text-on-primary wisp-transition hover:wisp-brightness-110 focus-visible:wisp-outline-none disabled:wisp-opacity-40"
                            aria-label="Send message"
                            title="Send message"
                            disabled={!ready || busy || !selectedModel}
                          >
                            <ChatIcon size={18} name="send" />
                          </ComposerPrimitive.Send>
                        )}
                      </div>
                    </div>
                  </ComposerPrimitive.Root>
                </ComposerPrimitive.AttachmentDropzone>
              </Transition>
            </div>
          </ThreadPrimitive.Root>
        </MessagesContext.Provider>
      </DownloadContext.Provider>
    </AssistantRuntimeProvider>
  )
}
