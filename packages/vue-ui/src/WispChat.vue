<script setup lang="ts">
import ChatSignIn from './ChatSignIn.vue'
import { provideChatMessages } from './useChatMessages.js'
import type { WispChatActions } from './actions.js'
import { defaultMessages } from './messages.js'
import ChatConversationPicker from './ChatConversationPicker.vue'
import ChatModelPicker from './ChatModelPicker.vue'
import ChatOptionsMenu from './ChatOptionsMenu.vue'
import ChatIconButton from './ChatIconButton.vue'
import ChatIcon from './ChatIcon.vue'
import ChatSpinner from './ChatSpinner.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { generateId } from '@assistant-ui/core'
import type {
  AppendMessage,
  AttachmentAdapter,
  CompleteAttachment,
  ExternalStoreAdapter,
  PendingAttachment,
} from '@assistant-ui/core'
import {
  AssistantRuntimeImpl,
  ExternalStoreRuntimeCore,
} from '@assistant-ui/core/internal'
import { RuntimeAdapter } from '@assistant-ui/core/store'
import {
  AuiConfig,
  AuiProvider,
  ComposerPrimitiveAddAttachment,
  ComposerPrimitiveAttachmentDropzone,
  ComposerPrimitiveAttachments,
  ComposerPrimitiveCancel,
  ComposerPrimitiveInput,
  ComposerPrimitiveSend,
  ThreadPrimitiveMessages,
  ThreadPrimitiveViewport,
} from '@assistant-ui/vue'
import type { WispChatBinding } from '@southneuhof/wisp-vue'
import type { ChatMessages, ChatErrorMessages } from './messages.js'
import type { WispChatTheme } from './theme.js'
import { useChatTheme } from './useChatTheme.js'
import type { Conversation, WorkspaceState } from '@southneuhof/wisp-core'
import type {
  ConversationMessage,
  NativeAttachmentDisplayData,
} from './runtime/conversation'
import { toThreadMessage } from './runtime/conversation'
import {
  canonicalMimeType,
  validateChatDraft,
} from './runtime/attachmentValidation'
import ChatAttachmentPreview from './ChatAttachmentPreview.vue'
import ChatModelContext from './ChatModelContext.vue'
import ChatMessage from './ChatMessage.vue'

const props = defineProps<{
  chat: WispChatBinding
  theme?: Partial<WispChatTheme>
  title?: string
  messages?: Partial<ChatMessages>
  errors?: ChatErrorMessages
}>()
const chat = props.chat
const endpoint = chat.url
const themeStyle = useChatTheme(() => props.theme)
const t = computed(() => ({ ...defaultMessages, ...props.messages }))
provideChatMessages(t)
const snapshot = computed(() => chat.state.value)
const account = computed(() =>
  snapshot.value.status === 'authenticated' ? snapshot.value.account : null,
)
const workspaces = computed(() =>
  snapshot.value.status === 'authenticated' ? snapshot.value.workspaces : [],
)
const workspaceState = computed(() =>
  snapshot.value.status === 'authenticated' ? snapshot.value.workspace : null,
)
const workspace = computed(() =>
  workspaceState.value?.status === 'ready' ? workspaceState.value : null,
)
const selectedModelId = ref('')
const selectedModelName = computed(
  () =>
    workspace.value?.models.find((model) => model.id === selectedModelId.value)
      ?.name ?? 'Select model',
)
const modelPreferenceKey = computed(() =>
  account.value && workspace.value
    ? `os-chat:model:${endpoint}:${account.value.id}:${workspace.value.workspace.id}`
    : '',
)
const connectionState = computed<'idle' | 'connecting' | 'ready' | 'error'>(
  () => {
    const state = snapshot.value
    if (
      state.status === 'starting' ||
      state.status === 'signing-in' ||
      state.connection === 'recovering'
    )
      return 'connecting'
    if (state.status !== 'authenticated')
      return state.status === 'disposed' ? 'error' : 'idle'
    if (state.connection === 'offline') return 'error'
    if (state.workspace.status === 'ready') return 'ready'
    if (state.workspace.status === 'opening') return 'connecting'
    if (state.workspace.status === 'unavailable') return 'error'
    return 'idle'
  },
)
const connectionError = computed(() => {
  const state = snapshot.value
  if (state.error)
    return props.errors?.[state.error.code] ?? state.error.message
  if (
    state.status === 'authenticated' &&
    state.workspace.status === 'unavailable'
  )
    return 'This workspace is unavailable. Choose another workspace or try again.'
  return 'CloudflareOS is unavailable. Check your connection and try again.'
})
const composerError = ref('')
const composerOpen = ref(false)
const threadScrolled = ref(false)
const threadScrollTop = ref<number | null>(null)
const threadWasAtBottom = ref(true)
const launcherElement = ref<HTMLButtonElement | null>(null)
const floatingElement = ref<HTMLDivElement | null>(null)
const username = ref('')
const password = ref('')
const busyAction = ref(false)
const sending = ref(false)
const conversationsLoading = ref(false)
const conversationsError = ref('')
const loadingConversationId = ref<number | null>(null)
const retryRequest = ref<{ text: string; files: File[] }>()
const focusPending = ref(false)
let focusObserver: MutationObserver | undefined
let threadRestoreRequest = 0
let downloadUrlTimer: ReturnType<typeof setTimeout> | undefined
const downloadAttachmentUrls = new Set<string>()
const draftFiles = new Map<string, File>()
let autoSelectingWorkspace = false

const pastConversations = computed<readonly Conversation[]>(
  () => workspace.value?.conversations ?? [],
)
const selectedChatId = computed(() => {
  const view = workspace.value?.conversation
  return view && view.status !== 'draft' ? view.id : null
})
const currentConversationTitle = computed(() => {
  const view = workspace.value?.conversation
  if (!view || view.status === 'draft') return 'New conversation'
  return (
    workspace.value?.conversations.find((item) => item.id === view.id)?.title ||
    `Conversation ${view.id}`
  )
})
const messages = computed<ConversationMessage[]>(() =>
  (workspace.value?.conversation.messages ?? []).map((message, index) => ({
    id: message.id,
    role: message.role,
    text: message.text,
    status:
      message.status === 'running'
        ? { type: 'running' as const }
        : message.status === 'complete'
          ? { type: 'complete' as const }
          : {
              type: 'incomplete' as const,
              reason:
                message.status === 'cancelled'
                  ? ('cancelled' as const)
                  : ('error' as const),
            },
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      source: {
        kind: 'history' as const,
        chatId: attachment.chatId,
        attachmentId: attachment.id,
      },
    })),
    sequence: message.sequence,
    order: message.sequence ?? index,
  })),
)
const hasEarlier = computed(() => workspace.value?.hasEarlier ?? false)
const loadingEarlier = computed(() => workspace.value?.loadingEarlier ?? false)
const uploadCount = computed(() => (workspace.value?.uploading ? 1 : 0))
const isSelectedTurnActive = computed(() => workspace.value?.running ?? false)
const isBusy = computed(
  () =>
    busyAction.value ||
    sending.value ||
    (workspace.value?.running ?? false) ||
    (workspace.value?.uploading ?? false),
)
const showSelectedAgentThinking = computed(() => {
  const current = workspace.value
  if (!current?.running) return false
  const lastMessage = current.conversation.messages.at(-1)
  return !lastMessage || lastMessage.role === 'user'
})

function attachmentType(mimeType: string): PendingAttachment['type'] {
  if (mimeType.startsWith('image/')) return 'image'
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/json'
  )
    return 'document'
  return 'file'
}

const attachmentAdapter: AttachmentAdapter = {
  accept: '*',
  async add({ file }): Promise<PendingAttachment> {
    if (
      connectionState.value !== 'ready' ||
      isBusy.value ||
      !selectedModelId.value
    )
      throw new Error('Chat is unavailable.')
    const error = validateChatDraft('x', [...draftFiles.values(), file])
    if (
      error &&
      error !== 'Enter a question or attach a file before sending.'
    ) {
      composerError.value = error
      throw new Error(error)
    }
    const id = generateId()
    draftFiles.set(id, file)
    return {
      id,
      type: attachmentType(canonicalMimeType(file)),
      name: file.name,
      contentType: canonicalMimeType(file),
      file,
      status: { type: 'requires-action', reason: 'composer-send' },
    }
  },
  async remove(attachment): Promise<void> {
    draftFiles.delete(attachment.id)
  },
  async send(attachment, options): Promise<CompleteAttachment> {
    if (options?.signal?.aborted)
      throw new DOMException('Upload cancelled', 'AbortError')
    return {
      ...attachment,
      status: { type: 'complete' },
      content: [
        {
          type: 'data',
          name: 'wisp-native',
          data: {
            kind: 'native',
            mimeType: canonicalMimeType(attachment.file),
            name: attachment.name,
          },
        },
      ],
    }
  },
}

let runtimeCore: ExternalStoreRuntimeCore | undefined
function createRuntimeAdapter(): ExternalStoreAdapter<ConversationMessage> {
  return {
    messages: messages.value,
    isLoading: connectionState.value === 'connecting',
    isRunning: isSelectedTurnActive.value,
    isDisabled:
      connectionState.value !== 'ready' ||
      busyAction.value ||
      !selectedModelId.value,
    isSendDisabled:
      connectionState.value !== 'ready' ||
      isBusy.value ||
      !selectedModelId.value,
    hasEarlier: hasEarlier.value,
    onLoadEarlier: loadEarlierHistory,
    onNew: handleNewMessage,
    onCancel: stopGeneration,
    convertMessage: toThreadMessage,
    adapters: { attachments: attachmentAdapter },
  }
}
function syncRuntime(): void {
  runtimeCore?.setAdapter(createRuntimeAdapter())
}
const runtimeCoreInstance = new ExternalStoreRuntimeCore(createRuntimeAdapter())
runtimeCore = runtimeCoreInstance
const runtime = new AssistantRuntimeImpl(runtimeCoreInstance)
const runtimeConfig = AuiConfig({ threads: RuntimeAdapter(runtime) })
watch(
  [snapshot, messages, connectionState, isBusy, hasEarlier, selectedModelId],
  syncRuntime,
  { flush: 'post' },
)
watch(
  [account, workspaces, workspaceState, busyAction],
  async ([currentAccount, availableWorkspaces, currentWorkspace]) => {
    if (
      !currentAccount ||
      busyAction.value ||
      autoSelectingWorkspace ||
      currentWorkspace?.status !== 'none' ||
      availableWorkspaces.length === 0
    )
      return
    const firstWorkspace = availableWorkspaces[0]
    if (!firstWorkspace) return
    autoSelectingWorkspace = true
    busyAction.value = true
    try {
      await chat.client.workspaces.select(firstWorkspace.id)
    } catch {
      composerError.value =
        'The default workspace could not be opened. Choose a workspace from Chat settings.'
    } finally {
      busyAction.value = false
      autoSelectingWorkspace = false
    }
  },
  { flush: 'post' },
)
watch(
  modelPreferenceKey,
  (key) => {
    const current = workspace.value
    if (!key || !current) {
      selectedModelId.value = ''
      return
    }
    let storedModelId = ''
    try {
      storedModelId = window.localStorage.getItem(key) ?? ''
    } catch {}
    const preferredModelId = current.models.some(
      (model) => model.id === storedModelId,
    )
      ? storedModelId
      : (current.modelId ?? current.models[0]?.id ?? '')
    selectedModelId.value = preferredModelId
    if (preferredModelId && preferredModelId !== current.modelId) {
      try {
        chat.client.models.select(preferredModelId)
      } catch {
        composerError.value =
          'The saved model is unavailable. Choose another model.'
      }
    }
  },
  { immediate: true, flush: 'post' },
)
watch(
  () =>
    `${workspace.value?.workspace.id ?? ''}:${selectedChatId.value ?? 'draft'}`,
  () => {
    draftFiles.clear()
    threadScrollTop.value = null
    threadWasAtBottom.value = true
    threadScrolled.value = false
    void runtime.thread.composer.reset()
    syncRuntime()
  },
)

function selectedWorkspaceId(current: WorkspaceState | null): string {
  if (!current) return ''
  switch (current.status) {
    case 'none':
      return ''
    case 'opening':
      return current.id
    case 'unavailable':
      return current.workspace.id
    case 'ready':
      return current.workspace.id
    default: {
      const exhaustive: never = current
      return exhaustive
    }
  }
}
function handleThreadScroll(event: Event): void {
  if (!(event.target instanceof HTMLElement)) return
  threadScrollTop.value = event.target.scrollTop
  threadWasAtBottom.value =
    event.target.scrollHeight -
      event.target.clientHeight -
      event.target.scrollTop <=
    1
  threadScrolled.value = event.target.scrollTop > 1
}
async function restoreThreadScrollPosition(): Promise<void> {
  const savedScrollTop = threadScrollTop.value
  if (savedScrollTop === null) return
  const request = ++threadRestoreRequest
  await nextTick()
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  )
  if (!composerOpen.value || request !== threadRestoreRequest) return
  const viewport =
    floatingElement.value?.querySelector<HTMLElement>('.wisp-thread-fade')
  if (!viewport) return
  viewport.scrollTop = threadWasAtBottom.value
    ? viewport.scrollHeight
    : savedScrollTop
  threadScrollTop.value = viewport.scrollTop
  threadScrolled.value = viewport.scrollTop > 1
}
async function loadPastConversations(): Promise<void> {
  if (!workspace.value || conversationsLoading.value) return
  conversationsLoading.value = true
  conversationsError.value = ''
  try {
    await chat.client.conversations.list()
  } catch {
    conversationsError.value = 'Conversations could not be loaded.'
  } finally {
    conversationsLoading.value = false
  }
}
function handleConversationPickerOpen(isOpen: boolean): void {
  if (isOpen) void loadPastConversations()
}
function clearConversation(): void {
  if (!workspace.value || isBusy.value) return
  chat.client.conversations.startNew()
  retryRequest.value = undefined
  composerError.value = ''
  void runtime.thread.composer.reset()
}
function startNewConversation(): void {
  clearConversation()
}
async function selectConversation(conversation: Conversation): Promise<void> {
  if (!workspace.value || isBusy.value || loadingConversationId.value !== null)
    return
  loadingConversationId.value = conversation.id
  composerError.value = ''
  try {
    await chat.client.conversations.select(conversation.id)
    retryRequest.value = undefined
    await runtime.thread.composer.reset()
  } catch {
    composerError.value = 'This conversation could not be opened.'
  } finally {
    loadingConversationId.value = null
  }
}
async function loadEarlierHistory(): Promise<void> {
  if (!workspace.value || !hasEarlier.value || loadingEarlier.value) return
  try {
    await chat.client.conversations.loadEarlier()
  } catch {
    composerError.value = 'Earlier messages could not be loaded.'
  }
}
async function handleNewMessage(message: AppendMessage): Promise<void> {
  if (!workspace.value || connectionState.value !== 'ready' || isBusy.value)
    return
  const text = message.content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('')
    .trim()
  const files = (message.attachments ?? []).flatMap((attachment) => {
    const file = draftFiles.get(attachment.id) ?? attachment.file
    return file ? [file] : []
  })
  const validationError = validateChatDraft(text, files)
  if (validationError) {
    composerError.value = validationError
    return
  }
  retryRequest.value = { text, files }
  composerError.value = ''
  sending.value = true
  try {
    const contextModelId = runtime.thread.getModelContext().config?.modelName
    if (contextModelId && contextModelId !== workspace.value.modelId)
      chat.client.models.select(contextModelId)
    await chat.client.conversations.send({ text, files })
    retryRequest.value = undefined
  } catch {
    composerError.value =
      'Assistant could not finish the response. Try sending your question again.'
  } finally {
    for (const attachment of message.attachments ?? [])
      draftFiles.delete(attachment.id)
    sending.value = false
  }
}
async function stopGeneration(): Promise<void> {
  if (!workspace.value || !isBusy.value) return
  try {
    await chat.client.conversations.stop()
  } catch {
    composerError.value = 'Assistant could not be stopped. Try again.'
  }
}
async function retryLastRequest(): Promise<void> {
  const request = retryRequest.value
  if (!request || !workspace.value || isBusy.value) return
  composerError.value = ''
  sending.value = true
  try {
    await chat.client.conversations.send(request)
    retryRequest.value = undefined
  } catch {
    composerError.value =
      'Assistant could not finish the response. Try sending your question again.'
  } finally {
    sending.value = false
  }
}
async function handleDownload(
  data: NativeAttachmentDisplayData,
): Promise<void> {
  if (
    data.chatId === undefined ||
    data.attachmentId === undefined ||
    !workspace.value
  )
    return
  const attachment = workspace.value.conversation.messages
    .flatMap((message) => message.attachments)
    .find(
      (item) => item.chatId === data.chatId && item.id === data.attachmentId,
    )
  if (!attachment) return
  try {
    const blob = await chat.client.attachments.download(attachment)
    const url = URL.createObjectURL(blob)
    downloadAttachmentUrls.add(url)
    const link = document.createElement('a')
    link.href = url
    link.download = data.name
    link.hidden = true
    document.body.appendChild(link)
    link.click()
    link.remove()
    if (downloadUrlTimer) clearTimeout(downloadUrlTimer)
    downloadUrlTimer = setTimeout(() => {
      downloadAttachmentUrls.delete(url)
      URL.revokeObjectURL(url)
    }, 1000)
  } catch {
    composerError.value = 'This attachment could not be downloaded.'
  }
}
function handleOutsidePointerDown(event: PointerEvent): void {
  if (!composerOpen.value || !(event.target instanceof Node)) return
  if (
    event.target instanceof Element &&
    (event.target.closest('.wisp-menu-content') ||
      event.target.closest('.wisp-menu-content'))
  )
    return
  if (floatingElement.value?.contains(event.target)) return
  handleClose(false)
}
async function focusComposerWhenReady(): Promise<void> {
  if (
    !focusPending.value ||
    !composerOpen.value ||
    connectionState.value !== 'ready'
  )
    return
  await nextTick()
  if (
    !focusPending.value ||
    !composerOpen.value ||
    connectionState.value !== 'ready'
  )
    return
  const input = document.querySelector<HTMLTextAreaElement>('[data-wisp-input]')
  if (!input) return
  focusObserver?.disconnect()
  if (input.disabled) {
    focusObserver = new MutationObserver(() => {
      const current =
        document.querySelector<HTMLTextAreaElement>('[data-wisp-input]')
      if (
        !focusPending.value ||
        !composerOpen.value ||
        !current ||
        current.disabled
      )
        return
      focusObserver?.disconnect()
      focusObserver = undefined
      current.focus()
      focusPending.value = false
    })
    focusObserver.observe(input, {
      attributes: true,
      attributeFilter: ['disabled'],
    })
    return
  }
  input.focus()
  focusPending.value = false
}
watch(
  [composerOpen, connectionState],
  () => {
    void focusComposerWhenReady()
    if (composerOpen.value && connectionState.value === 'ready')
      void restoreThreadScrollPosition()
  },
  { flush: 'post' },
)
function handleOpen(): void {
  composerOpen.value = true
  focusPending.value = true
  void focusComposerWhenReady()
}
function handleClose(restoreFocus = true): void {
  const viewport =
    floatingElement.value?.querySelector<HTMLElement>('.wisp-thread-fade')
  if (viewport) {
    threadScrollTop.value = viewport.scrollTop
    threadWasAtBottom.value =
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 1
  }
  composerOpen.value = false
  focusPending.value = false
  threadRestoreRequest++
  focusObserver?.disconnect()
  focusObserver = undefined
  if (restoreFocus) void nextTick(() => launcherElement.value?.focus())
}
function handleCloseFromButton(): void {
  handleClose()
}
async function signIn(): Promise<void> {
  const name = username.value.trim()
  const secret = password.value
  password.value = ''
  if (!name || !secret) return
  busyAction.value = true
  composerError.value = ''
  try {
    await chat.client.auth.signIn({ username: name, password: secret })
  } catch {
    composerError.value = 'Sign-in failed. Check your username and password.'
  } finally {
    busyAction.value = false
  }
}
async function selectWorkspace(id: string): Promise<void> {
  if (!id || busyAction.value) return
  busyAction.value = true
  try {
    await chat.client.workspaces.select(id)
    retryRequest.value = undefined
    composerError.value = ''
    await runtime.thread.composer.reset()
  } catch {
    composerError.value = 'This workspace could not be opened.'
  } finally {
    busyAction.value = false
  }
}
async function createWorkspace(title: string): Promise<boolean> {
  if (!account.value || busyAction.value) return false
  busyAction.value = true
  try {
    await chat.client.workspaces.create({ title: title.trim() || undefined })
    return true
  } catch {
    composerError.value = 'The workspace could not be created.'
    return false
  } finally {
    busyAction.value = false
  }
}
function signOut(): void {
  if (isBusy.value) return
  chat.client.auth.signOut()
  username.value = ''
  password.value = ''
  retryRequest.value = undefined
  composerError.value = ''
}
function selectModel(id: string): void {
  if (!id || !workspace.value || isBusy.value) return
  try {
    chat.client.models.select(id)
    selectedModelId.value = id
    if (modelPreferenceKey.value) {
      try {
        window.localStorage.setItem(modelPreferenceKey.value, id)
      } catch {}
    }
  } catch {
    composerError.value = 'Select an available chat model.'
  }
}

const actions: WispChatActions = {
  signOut,
  selectWorkspace,
  selectModel,
  startNewConversation,
  refreshWorkspaces: async () => {
    await chat.client.workspaces.list()
  },
  createWorkspace: async (title) => {
    await createWorkspace(title ?? '')
  },
  selectConversation: async (id) => {
    const item = pastConversations.value.find((item) => item.id === id)
    if (item) await selectConversation(item)
  },
}

onMounted(() =>
  document.addEventListener('pointerdown', handleOutsidePointerDown),
)
onBeforeUnmount(() => {
  draftFiles.clear()
  document.removeEventListener('pointerdown', handleOutsidePointerDown)
  focusObserver?.disconnect()
  if (downloadUrlTimer) clearTimeout(downloadUrlTimer)
  downloadAttachmentUrls.forEach((url) => URL.revokeObjectURL(url))
})
</script>

<template>
  <AuiProvider :config="runtimeConfig">
    <div class="wisp-ui" :style="themeStyle">
      <Transition name="wisp-launcher">
        <button
          v-if="!composerOpen"
          ref="launcherElement"
          type="button"
          :aria-label="t.openChat"
          :aria-expanded="composerOpen"
          class="wisp-fixed wisp-bottom-5 wisp-left-1/2 wisp-z-30 wisp-flex -wisp-translate-x-1/2 wisp-items-center wisp-gap-2 wisp-rounded-full wisp-bg-primary wisp-px-3 wisp-py-2 wisp-text-on-primary wisp-shadow-lg wisp-transition hover:wisp-brightness-110 focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary focus-visible:wisp-ring-offset-2"
          @click="handleOpen"
        >
          <span
            class="wisp-text-[11px] wisp-font-semibold wisp-tracking-wide"
            >{{ title || t.openChat }}</span
          >
        </button>
      </Transition>

      <div
        ref="floatingElement"
        class="wisp-floating wisp-pointer-events-none wisp-fixed wisp-inset-x-0 wisp-bottom-0 wisp-z-30 wisp-flex wisp-max-h-[calc(100dvh-16px)] wisp-flex-col wisp-items-center wisp-px-4"
        :class="{ 'wisp-floating-open': composerOpen }"
        :style="{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }"
        :aria-hidden="!composerOpen"
        :inert="!composerOpen"
      >
        <div
          class="wisp-history wisp-pointer-events-auto wisp-relative wisp-mb-0 wisp-flex wisp-h-auto wisp-min-h-16 wisp-w-full wisp-max-w-[680px] wisp-shrink-0 wisp-flex-col"
        >
          <div aria-hidden="true" class="wisp-backdrop" />
          <div aria-hidden="true" class="wisp-backdrop-extra" />
          <Transition name="wisp-foreground">
            <div
              v-if="composerOpen"
              class="wisp-header wisp-pointer-events-auto wisp-relative wisp-z-30 wisp-mb-2 wisp-flex wisp-min-h-10 wisp-w-full wisp-shrink-0 wisp-items-center wisp-justify-between wisp-gap-2"
            >
              <slot
                name="header"
                :account="account"
                :workspaces="workspaces"
                :workspace="workspaceState"
                :snapshot="snapshot"
                :busy="isBusy"
                :actions="actions"
                ><div
                  class="wisp-header-left wisp-flex wisp-min-w-0 wisp-items-center wisp-gap-2"
                >
                  <ChatConversationPicker
                    v-if="workspace && connectionState === 'ready'"
                    :title="currentConversationTitle"
                    :conversations="pastConversations"
                    :selected-id="selectedChatId"
                    :loading="loadingConversationId !== null"
                    :busy="isBusy"
                    :error="conversationsError"
                    :loading-list="conversationsLoading"
                    :theme-style="themeStyle"
                    @open="handleConversationPickerOpen"
                    @select="selectConversation"
                    @new="startNewConversation"
                    @retry="loadPastConversations"
                  />
                </div>
                <div
                  class="wisp-header-right wisp-flex wisp-shrink-0 wisp-items-center wisp-gap-1"
                >
                  <ChatOptionsMenu
                    :account="account"
                    :workspaces="workspaces"
                    :workspace-id="selectedWorkspaceId(workspaceState)"
                    :busy="isBusy"
                    :endpoint="endpoint"
                    :theme-style="themeStyle"
                    :create-workspace="createWorkspace"
                    @workspace="selectWorkspace"
                    @sign-out="signOut"
                  />
                  <ChatIconButton
                    class="wisp-flex wisp-items-center wisp-justify-center wisp-text-on-surface-variant hover:wisp-bg-on-surface/10 focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary"
                    label="Close chat"
                    @click="handleCloseFromButton"
                    icon="close"
                  /></div
              ></slot>
            </div>
          </Transition>
          <Transition name="wisp-foreground">
            <div
              v-if="composerOpen"
              aria-label="Chat with assistant"
              class="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-flex wisp-h-auto wisp-min-h-0 wisp-w-full wisp-flex-col wisp-justify-end"
            >
              <div
                v-if="!account && connectionState === 'connecting'"
                class="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-mx-auto wisp-flex wisp-min-h-[320px] wisp-w-full wisp-max-w-[680px] wisp-items-center wisp-justify-center wisp-px-4 wisp-py-6 wisp-text-sm wisp-text-on-surface-variant"
                role="status"
              >
                <ChatSpinner class="wisp-mr-2 wisp-inline-block" />Connecting to
                CloudflareOS...
              </div>
              <ChatSignIn
                v-else-if="!account"
                v-model:username="username"
                v-model:password="password"
                :busy="busyAction"
                :error="composerError"
                @submit="signIn"
              />
              <div
                v-else-if="account && connectionState === 'error'"
                class="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-mx-auto wisp-w-full wisp-max-w-[680px] wisp-px-4 wisp-py-5"
                role="alert"
              >
                <div
                  class="wisp-w-full wisp-rounded-2xl wisp-border wisp-border-outline-variant wisp-p-4 wisp-text-sm wisp-text-on-surface wisp-shadow-sm"
                >
                  {{ connectionError }}
                </div>
              </div>
              <div
                v-else-if="
                  account && workspaceState?.status === 'none' && !busyAction
                "
                class="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-mx-auto wisp-flex wisp-min-h-[320px] wisp-w-full wisp-max-w-[680px] wisp-items-center wisp-justify-center wisp-px-6 wisp-py-8 wisp-text-center wisp-text-sm wisp-text-on-surface-variant"
              >
                Select a workspace from Chat settings to start a conversation.
              </div>
              <div
                v-else-if="
                  account &&
                  !workspace &&
                  (busyAction || workspaceState?.status === 'opening')
                "
                class="wisp-flex wisp-items-center wisp-justify-center wisp-gap-2 wisp-py-4 wisp-text-sm wisp-text-on-surface-variant"
                role="status"
              >
                <ChatSpinner />{{ t.loading }}
              </div>

              <slot
                name="controls"
                :account="account"
                :workspaces="workspaces"
                :workspace="workspaceState"
                :snapshot="snapshot"
                :busy="isBusy"
                :actions="actions"
              />
              <p
                v-if="workspace && !workspace.models.length"
                class="wisp-px-4 wisp-py-3 wisp-text-sm wisp-text-error"
              >
                {{ t.noModels }}
              </p>
              <slot
                v-if="
                  account &&
                  workspace &&
                  connectionState === 'ready' &&
                  !messages.length &&
                  !showSelectedAgentThinking
                "
                name="empty-state"
              />
              <ThreadPrimitiveViewport
                v-if="
                  account &&
                  workspace &&
                  connectionState === 'ready' &&
                  (messages.length || showSelectedAgentThinking)
                "
                class="wisp-thread-fade wisp-relative wisp-z-10 wisp-min-h-0 wisp-overflow-y-auto wisp-overscroll-contain wisp-px-1"
                :class="{ 'wisp-thread-scrolled': threadScrolled }"
                :auto-scroll="threadWasAtBottom"
                :scroll-to-bottom-on-initialize="threadScrollTop === null"
                @scroll="handleThreadScroll"
              >
                <div
                  class="wisp-flex wisp-flex-col wisp-justify-end wisp-pb-8 wisp-pt-2"
                >
                  <div v-if="hasEarlier" class="wisp-py-2 wisp-text-center">
                    <button
                      type="button"
                      class="wisp-rounded-full wisp-px-3 wisp-py-1 wisp-text-xs wisp-text-on-surface-variant hover:wisp-bg-on-surface/8 disabled:wisp-opacity-50"
                      :disabled="loadingEarlier"
                      @click="loadEarlierHistory"
                    >
                      {{
                        loadingEarlier ? 'Loading...' : 'Load earlier messages'
                      }}
                    </button>
                  </div>
                  <ThreadPrimitiveMessages>
                    <template #default>
                      <slot name="message"
                        ><ChatMessage @download="handleDownload"
                      /></slot>
                    </template>
                  </ThreadPrimitiveMessages>
                  <div
                    v-if="showSelectedAgentThinking"
                    class="wisp-mb-2 wisp-flex wisp-w-full wisp-justify-start"
                    role="status"
                    aria-live="polite"
                    aria-label="Assistant is thinking"
                  >
                    <div
                      class="wisp-flex wisp-items-center wisp-gap-1.5 wisp-rounded-2xl wisp-bg-surface-container-high/80 wisp-px-4 wisp-py-3 wisp-text-on-surface-variant wisp-shadow-sm"
                      aria-hidden="true"
                    >
                      <span
                        v-for="dot in 3"
                        :key="dot"
                        class="wisp-h-1.5 wisp-w-1.5 wisp-animate-bounce wisp-rounded-full wisp-bg-on-surface-variant/70"
                        :style="{ animationDelay: `${(dot - 3) * 120}ms` }"
                      />
                    </div>
                    <span class="wisp-sr-only">Assistant is thinking</span>
                  </div>
                </div>
              </ThreadPrimitiveViewport>
            </div>
          </Transition>
          <div
            aria-hidden="true"
            class="wisp-message-blur"
            :class="{
              'wisp-blur-visible':
                composerOpen && connectionState === 'ready' && threadScrolled,
            }"
          />
        </div>

        <ChatModelContext
          v-if="account && workspace"
          :model-id="selectedModelId"
        >
          <Transition name="wisp-foreground" appear>
            <ComposerPrimitiveAttachmentDropzone
              @drop.prevent
              @dragover.prevent
              v-if="composerOpen"
              class="wisp-composer wisp-pointer-events-auto wisp-relative wisp-z-30 -wisp-mt-5 wisp-w-full wisp-max-w-[680px] wisp-shrink-0 wisp-rounded-3xl wisp-bg-surface-container-high wisp-text-on-surface wisp-shadow-lg"
              :disabled="
                connectionState !== 'ready' || isBusy || !selectedModelId
              "
            >
              <div class="wisp-relative wisp-z-10">
                <div
                  v-if="retryRequest && connectionState === 'ready'"
                  class="wisp-px-3 wisp-pb-2"
                >
                  <button
                    type="button"
                    aria-label="Retry request"
                    class="wisp-text-xs wisp-font-medium wisp-text-primary wisp-underline wisp-underline-offset-2 disabled:wisp-opacity-50"
                    :disabled="isBusy"
                    @click="retryLastRequest"
                  >
                    Try again
                  </button>
                </div>
                <p
                  v-if="composerError"
                  class="wisp-px-3 wisp-pb-2 wisp-text-xs wisp-text-error"
                  role="alert"
                >
                  {{ composerError }}
                </p>

                <div class="wisp-flex wisp-flex-wrap wisp-gap-2 wisp-px-2">
                  <ComposerPrimitiveAttachments>
                    <template #default>
                      <div
                        class="wisp-mb-2 wisp-min-w-[180px] wisp-max-w-full wisp-rounded-xl wisp-bg-surface-container-high/70 wisp-p-2 wisp-text-on-surface wisp-shadow-sm"
                      >
                        <ChatAttachmentPreview :removable="true" />
                      </div>
                    </template>
                  </ComposerPrimitiveAttachments>
                </div>

                <div class="wisp-rounded-xl wisp-p-2">
                  <ComposerPrimitiveInput
                    data-wisp-input
                    class="wisp-max-h-36 wisp-min-h-11 wisp-w-full wisp-min-w-0 wisp-resize-y wisp-bg-transparent wisp-px-1 wisp-py-2 wisp-text-sm wisp-text-on-surface wisp-outline-none placeholder:wisp-text-on-surface-variant/80"
                    placeholder="Ask me anything…"
                    :disabled="
                      connectionState !== 'ready' || isBusy || !selectedModelId
                    "
                  />
                  <div class="wisp-flex wisp-items-center wisp-gap-2 wisp-pt-1">
                    <ComposerPrimitiveAddAttachment
                      class="wisp-flex wisp-h-9 wisp-w-9 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-full wisp-text-on-surface-variant wisp-transition hover:wisp-bg-on-surface/10 focus-visible:wisp-outline-none disabled:wisp-opacity-40"
                      aria-label="Add attachment"
                      title="Add attachment"
                    >
                      <ChatIcon :size="20" name="attach_file" />
                    </ComposerPrimitiveAddAttachment>
                    <ChatModelPicker
                      :models="workspace.models"
                      :selected-id="selectedModelId"
                      :name="selectedModelName"
                      :busy="isBusy"
                      :theme-style="themeStyle"
                      @select="selectModel"
                    />
                    <slot name="composer-actions" :chat="chat" />
                    <div class="wisp-flex-1" />
                    <ComposerPrimitiveCancel
                      v-if="uploadCount > 0 || isSelectedTurnActive"
                      aria-label="Stop Assistant"
                      class="wisp-flex wisp-h-9 wisp-w-9 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-full wisp-bg-error/15 wisp-text-error wisp-transition hover:wisp-bg-error/25 focus-visible:wisp-outline-none"
                    >
                      <ChatIcon :size="18" name="stop" />
                    </ComposerPrimitiveCancel>
                    <ComposerPrimitiveSend
                      v-else
                      class="wisp-flex wisp-h-9 wisp-w-9 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-full wisp-bg-primary wisp-text-on-primary wisp-transition hover:wisp-brightness-110 focus-visible:wisp-outline-none disabled:wisp-opacity-40"
                      aria-label="Send message"
                      title="Send message"
                      :disabled="
                        connectionState !== 'ready' ||
                        isBusy ||
                        !selectedModelId
                      "
                    >
                      <ChatIcon :size="18" name="send" />
                    </ComposerPrimitiveSend>
                  </div>
                </div>
              </div>
            </ComposerPrimitiveAttachmentDropzone>
          </Transition>
        </ChatModelContext>
      </div>
    </div>
  </AuiProvider>
</template>

<style scoped>
.wisp-launcher-enter-active,
.wisp-launcher-leave-active {
  transition: opacity 180ms ease;
}

.wisp-launcher-enter-from,
.wisp-launcher-leave-to {
  opacity: 0;
}

.wisp-floating {
  visibility: hidden;
  transition: visibility 0s linear 280ms;
}

.wisp-floating-open {
  visibility: visible;
  transition-delay: 0s;
}

.wisp-foreground-enter-active,
.wisp-foreground-leave-active {
  transform-origin: center bottom;
  will-change: opacity, filter, scale;
  transition:
    opacity 280ms ease,
    filter 280ms ease,
    scale 280ms cubic-bezier(0.2, 0.75, 0.25, 1);
}

.wisp-foreground-enter-from {
  opacity: 0;
  filter: blur(16px);
  scale: 1.08;
}

.wisp-foreground-leave-to {
  opacity: 0;
  filter: blur(16px);
  scale: 1.02;
}

.wisp-foreground-enter-to,
.wisp-foreground-leave-from {
  opacity: 1;
  filter: blur(0);
  scale: 1;
}

.wisp-backdrop {
  --blur-outset-x: 88px;
  position: absolute;
  inset: -96px -88px -64px;
  z-index: 0;
  pointer-events: none;
  opacity: 0;
  -webkit-backdrop-filter: blur(0px);
  backdrop-filter: blur(0px);
  transition:
    opacity 280ms ease,
    -webkit-backdrop-filter 280ms ease,
    backdrop-filter 280ms ease;
  -webkit-mask-image:
    linear-gradient(
      to right,
      transparent 0,
      black var(--blur-outset-x),
      black calc(100% - var(--blur-outset-x)),
      transparent 100%
    ),
    var(--wisp-backdrop-vertical-mask);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(
      to right,
      transparent 0,
      black var(--blur-outset-x),
      black calc(100% - var(--blur-outset-x)),
      transparent 100%
    ),
    var(--wisp-backdrop-vertical-mask);
  mask-composite: intersect;
}

.wisp-backdrop-extra {
  --blur-outset-x: 88px;
  position: absolute;
  inset: -96px -88px -64px;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  -webkit-backdrop-filter: blur(0px);
  backdrop-filter: blur(0px);
  transition:
    opacity 280ms ease,
    -webkit-backdrop-filter 280ms ease,
    backdrop-filter 280ms ease;
  -webkit-mask-image:
    linear-gradient(
      to right,
      transparent 0,
      black var(--blur-outset-x),
      black calc(100% - var(--blur-outset-x)),
      transparent 100%
    ),
    var(--wisp-backdrop-vertical-mask);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(
      to right,
      transparent 0,
      black var(--blur-outset-x),
      black calc(100% - var(--blur-outset-x)),
      transparent 100%
    ),
    var(--wisp-backdrop-vertical-mask);
  mask-composite: intersect;
}

.wisp-message-blur {
  --blur-outset-x: 64px;
  position: absolute;
  inset: -32px -64px -64px;
  z-index: 20;
  pointer-events: none;
  opacity: 0;
  -webkit-backdrop-filter: blur(0px);
  backdrop-filter: blur(0px);
  transition:
    opacity 280ms ease,
    -webkit-backdrop-filter 280ms ease,
    backdrop-filter 280ms ease;
  -webkit-mask-image:
    linear-gradient(
      to right,
      transparent 0,
      black var(--blur-outset-x),
      black calc(100% - var(--blur-outset-x)),
      transparent 100%
    ),
    linear-gradient(
      to bottom,
      transparent 0%,
      rgb(0 0 0 / 0.25) 1%,
      rgb(0 0 0 / 0.75) 3%,
      black 5%,
      rgb(0 0 0 / 0.92) 9%,
      rgb(0 0 0 / 0.6) 12%,
      rgb(0 0 0 / 0.25) 14%,
      transparent 16%
    );
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(
      to right,
      transparent 0,
      black var(--blur-outset-x),
      black calc(100% - var(--blur-outset-x)),
      transparent 100%
    ),
    linear-gradient(
      to bottom,
      transparent 0%,
      rgb(0 0 0 / 0.25) 1%,
      rgb(0 0 0 / 0.75) 3%,
      black 5%,
      rgb(0 0 0 / 0.92) 9%,
      rgb(0 0 0 / 0.6) 12%,
      rgb(0 0 0 / 0.25) 14%,
      transparent 16%
    );
  mask-composite: intersect;
}

.wisp-history {
  --wisp-backdrop-vertical-mask: linear-gradient(
    to bottom,
    transparent 0,
    rgb(0 0 0 / 0.04) 20px,
    rgb(0 0 0 / 0.16) 40px,
    rgb(0 0 0 / 0.32) 60px,
    rgb(0 0 0 / 0.5) 80px,
    rgb(0 0 0 / 0.68) 100px,
    rgb(0 0 0 / 0.84) 120px,
    rgb(0 0 0 / 0.96) 140px,
    black 160px,
    black max(160px, calc(100% - 64px)),
    transparent 100%
  );
  --wisp-history-max-height: min(70dvh, calc(100dvh - 180px));
  max-height: var(--wisp-history-max-height);
}

.wisp-history .wisp-thread-fade {
  max-height: calc(var(--wisp-history-max-height) - 44px);
}

.wisp-floating-open .wisp-backdrop {
  opacity: 1;
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
}

.wisp-floating-open .wisp-backdrop-extra {
  opacity: 1;
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}

.wisp-message-blur.wisp-blur-visible {
  opacity: 1;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.wisp-thread-fade {
  --thread-fade: linear-gradient(
    to bottom,
    transparent 0,
    rgb(0 0 0 / 0.04) 14px,
    rgb(0 0 0 / 0.16) 28px,
    rgb(0 0 0 / 0.5) 55px,
    rgb(0 0 0 / 0.84) 76px,
    black 96px
  );
  -webkit-mask-image: var(--thread-fade);
  mask-image: var(--thread-fade);
  -webkit-mask-size: 100% calc(100% + 96px);
  mask-size: 100% calc(100% + 96px);
  -webkit-mask-position: 0 -96px;
  mask-position: 0 -96px;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  transition:
    -webkit-mask-position 280ms ease,
    mask-position 280ms ease;
}

.wisp-thread-fade.wisp-thread-scrolled {
  -webkit-mask-position: 0 0;
  mask-position: 0 0;
}

@media (prefers-reduced-motion: reduce) {
  .wisp-floating:not(.wisp-floating-open) {
    transition-delay: 1ms;
  }

  .wisp-launcher-enter-active,
  .wisp-launcher-leave-active,
  .wisp-backdrop,
  .wisp-backdrop-extra,
  .wisp-message-blur,
  .wisp-thread-fade,
  .wisp-foreground-enter-active,
  .wisp-foreground-leave-active {
    transition-duration: 1ms;
  }
}
</style>

<style>
.wisp-menu-content {
  background-color: var(--wisp-menu-bg);
  transform-origin: var(--reka-dropdown-menu-content-transform-origin);
  animation: wisp-menu-in 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.wisp-menu-content[data-state='closed'] {
  animation: wisp-menu-out 110ms ease-in forwards;
}

.wisp-menu-item[data-highlighted],
.wisp-menu-item[data-state='open'] {
  background-color: color-mix(in srgb, currentColor 8%, transparent);
}

.wisp-menu-item {
  user-select: none;
}

.wisp-menu-item[data-disabled] {
  opacity: 0.5;
  pointer-events: none;
}

.wisp-menu-item-primary,
.wisp-menu-action {
  cursor: pointer;
}

.wisp-menu-item-primary,
.wisp-menu-item-primary[data-highlighted] {
  background-color: var(--wisp-accent) !important;
  color: var(--wisp-primary-fg) !important;
}

.wisp-menu-item-primary[data-highlighted] {
  filter: brightness(0.94);
}

@keyframes wisp-menu-in {
  from {
    opacity: 0;
    transform: translateY(-3px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes wisp-menu-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-2px) scale(0.98);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wisp-menu-content {
    animation-duration: 1ms;
  }
}
</style>
