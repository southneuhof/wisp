import { createWispChat } from '@southneuhof/wisp-core'
import type { Attachment } from '@southneuhof/wisp-core'

const client = createWispChat({
  url: import.meta.env.VITE_CLOUDFLARE_OS_URL || 'http://127.0.0.1:8787',
})
const root = document.querySelector('#app')
if (!(root instanceof HTMLElement)) throw new Error('Missing app root')
function button(label: string, action: () => unknown) {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.onclick = () => {
    void Promise.resolve(action()).catch(() => {})
  }
  return element
}
function field(label: string, type = 'text') {
  const wrapper = document.createElement('label')
  wrapper.textContent = label
  const input = document.createElement('input')
  input.type = type
  input.autocomplete = type === 'password' ? 'current-password' : 'username'
  wrapper.append(input)
  return { wrapper, input }
}
const downloads = new Map<string, ReturnType<typeof setTimeout>>()
function clearDownloads() {
  for (const [url, timer] of downloads) {
    clearTimeout(timer)
    URL.revokeObjectURL(url)
  }
  downloads.clear()
}
let scope = ''
let generation = 0
async function download(attachment: Attachment) {
  const requestedGeneration = generation
  const blob = await client.attachments.download(attachment)
  if (generation !== requestedGeneration) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.name
  link.click()
  downloads.set(
    url,
    setTimeout(() => {
      URL.revokeObjectURL(url)
      downloads.delete(url)
    }, 1000),
  )
}
const error = document.createElement('p')
error.setAttribute('role', 'alert')
const login = document.createElement('form')
const username = field('Username'),
  password = field('Password', 'password')
const signIn = document.createElement('button')
signIn.textContent = 'Sign in'
login.append(username.wrapper, password.wrapper, signIn)
login.onsubmit = (event) => {
  event.preventDefault()
  const secret = password.input.value
  password.input.value = ''
  void client.auth
    .signIn({ username: username.input.value, password: secret })
    .catch(() => {})
}
const authenticated = document.createElement('section')
const identity = document.createElement('span')
const workspaces = document.createElement('select')
workspaces.ariaLabel = 'Workspace'
workspaces.onchange = () => {
  void client.workspaces.select(workspaces.value).catch(() => {})
}
const content = document.createElement('section')
const models = document.createElement('select')
models.ariaLabel = 'Model'
models.onchange = () => client.models.select(models.value)
const conversations = document.createElement('nav')
const earlier = button('Load earlier messages', () =>
  client.conversations.loadEarlier(),
)
const log = document.createElement('div')
log.setAttribute('role', 'log')
const composer = document.createElement('form')
const textarea = document.createElement('textarea')
textarea.ariaLabel = 'Message'
const files = document.createElement('input')
files.type = 'file'
files.multiple = true
files.ariaLabel = 'Attachments'
const send = document.createElement('button')
send.textContent = 'Send'
const stop = button('Stop', () => client.conversations.stop())
function updateSend() {
  const state = client.getSnapshot()
  send.disabled =
    state.status !== 'authenticated' ||
    state.workspace.status !== 'ready' ||
    !state.workspace.modelId ||
    state.workspace.running ||
    state.workspace.uploading ||
    state.workspace.conversation.status === 'loading' ||
    (!textarea.value.trim() && !files.files?.length)
}
textarea.oninput = updateSend
files.onchange = updateSend
composer.onsubmit = (event) => {
  event.preventDefault()
  if (send.disabled) return
  const input = { text: textarea.value, files: Array.from(files.files ?? []) }
  textarea.value = ''
  files.value = ''
  updateSend()
  void client.conversations.send(input).catch(() => {})
}
composer.append(textarea, files, send, stop)
content.append(
  models,
  button('New conversation', () => client.conversations.startNew()),
  conversations,
  earlier,
  log,
  composer,
)
authenticated.append(
  identity,
  button('Sign out', () => client.auth.signOut()),
  workspaces,
  button('Create workspace', () =>
    client.workspaces.create({ title: 'My workspace' }),
  ),
  content,
)
root.append(error, login, authenticated)
function options(
  select: HTMLSelectElement,
  values: readonly { id: string; name: string }[],
  empty: string,
) {
  const placeholder = new Option(empty, '')
  placeholder.disabled = true
  select.replaceChildren(
    placeholder,
    ...values.map((value) => new Option(value.name, value.id)),
  )
}
const unsubscribe = client.subscribe((state) => {
  const nextScope =
    state.status === 'authenticated'
      ? JSON.stringify([
          state.account.id,
          state.workspace.status === 'ready'
            ? state.workspace.workspace.id
            : null,
        ])
      : ''
  if (nextScope !== scope) {
    scope = nextScope
    generation++
    textarea.value = ''
    files.value = ''
    password.input.value = ''
    clearDownloads()
  }
  error.textContent = state.error?.message ?? ''
  login.hidden = state.status === 'authenticated'
  authenticated.hidden = state.status !== 'authenticated'
  signIn.disabled = state.status === 'signing-in' || state.status === 'starting'
  if (state.status !== 'authenticated') return
  identity.textContent = state.account.name
  options(
    workspaces,
    state.workspaces.map((w) => ({ id: w.id, name: w.title })),
    'Choose workspace',
  )
  content.hidden = state.workspace.status !== 'ready'
  if (state.workspace.status !== 'ready') return
  const workspace = state.workspace
  workspaces.value = workspace.workspace.id
  options(models, workspace.models, 'No chat model is available')
  models.value = workspace.modelId ?? ''
  conversations.replaceChildren(
    ...workspace.conversations.map((conversation) =>
      button(conversation.title, () =>
        client.conversations.select(conversation.id),
      ),
    ),
  )
  earlier.hidden = !workspace.hasEarlier
  earlier.disabled = workspace.loadingEarlier
  log.replaceChildren(
    ...workspace.conversation.messages.map((message) => {
      const item = document.createElement('article')
      item.textContent = `${message.role}: ${message.text}`
      for (const attachment of message.attachments)
        item.append(button(attachment.name, () => download(attachment)))
      return item
    }),
  )
  stop.hidden = !workspace.running
  updateSend()
})
void client.start().catch(() => {})
window.addEventListener(
  'pagehide',
  () => {
    scope = ''
    generation++
    password.input.value = ''
    textarea.value = ''
    files.value = ''
    clearDownloads()
    unsubscribe()
    client.dispose()
  },
  { once: true },
)
