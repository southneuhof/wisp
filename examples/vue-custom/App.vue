<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Attachment } from '@southneuhof/wisp-core'
import { useWispChat } from '@southneuhof/wisp-vue'
const { client, state } = useWispChat({
  url: import.meta.env.VITE_CLOUDFLARE_OS_URL || 'http://127.0.0.1:8787',
})
const username = ref('')
const password = ref('')
const text = ref('')
const title = ref('')
const files = ref<File[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const ready = computed(() =>
  state.value.status === 'authenticated' &&
  state.value.workspace.status === 'ready'
    ? state.value.workspace
    : null,
)
const scope = computed(() =>
  state.value.status === 'authenticated'
    ? JSON.stringify([
        state.value.account.id,
        ready.value?.workspace.id ?? null,
      ])
    : '',
)
let generation = 0
const downloads = new Map<string, ReturnType<typeof setTimeout>>()
function clearDownloads() {
  for (const [url, timer] of downloads) {
    clearTimeout(timer)
    URL.revokeObjectURL(url)
  }
  downloads.clear()
}
watch(
  scope,
  () => {
    generation++
    text.value = ''
    files.value = []
    title.value = ''
    password.value = ''
    if (fileInput.value) fileInput.value.value = ''
    clearDownloads()
  },
  { flush: 'sync' },
)
onScopeDispose(() => {
  generation++
  clearDownloads()
})
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
function chooseFiles(event: Event) {
  if (event.target instanceof HTMLInputElement)
    files.value = Array.from(event.target.files ?? [])
}
function selectModel(event: Event) {
  if (event.target instanceof HTMLSelectElement)
    client.models.select(event.target.value)
}
async function signIn() {
  const value = password.value
  password.value = ''
  await client.auth.signIn({ username: username.value, password: value })
}
async function send() {
  if (
    !ready.value?.modelId ||
    ready.value.running ||
    ready.value.uploading ||
    ready.value.conversation.status === 'loading' ||
    (!text.value.trim() && !files.value.length)
  )
    return
  const input = { text: text.value, files: files.value }
  text.value = ''
  files.value = []
  if (fileInput.value) fileInput.value.value = ''
  await client.conversations.send(input)
}
function select(event: Event) {
  if (event.target instanceof HTMLSelectElement)
    void client.workspaces.select(event.target.value).catch(() => {})
}
</script>
<template>
  <main>
    <h1>Custom Vue interface</h1>
    <p v-if="state.error" role="alert">{{ state.error.message }}</p>
    <form
      v-if="state.status !== 'authenticated'"
      @submit.prevent="signIn().catch(() => {})"
    >
      <label>Username<input v-model="username" autocomplete="username" /></label
      ><label
        >Password<input
          v-model="password"
          type="password"
          autocomplete="current-password" /></label
      ><button
        :disabled="state.status === 'starting' || state.status === 'signing-in'"
      >
        Sign in
      </button>
    </form>
    <template v-else
      ><p>
        {{ state.account.name }}
        <button @click="client.auth.signOut()">Sign out</button>
      </p>
      <select :value="ready?.workspace.id ?? ''" @change="select">
        <option value="" disabled>Choose workspace</option>
        <option v-for="w in state.workspaces" :key="w.id" :value="w.id">
          {{ w.title }}
        </option>
      </select>
      <form
        @submit.prevent="client.workspaces.create({ title }).catch(() => {})"
      >
        <label>Workspace name<input v-model="title" /></label
        ><button>Create workspace</button>
      </form>
      <template v-if="ready"
        ><label
          >Model<select :value="ready.modelId ?? ''" @change="selectModel">
            <option value="" disabled>No chat model is available</option>
            <option
              v-for="model in ready.models"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }}
            </option>
          </select></label
        ><button @click="client.conversations.startNew()">
          New conversation</button
        ><button
          v-for="c in ready.conversations"
          :key="c.id"
          @click="client.conversations.select(c.id).catch(() => {})"
        >
          {{ c.title }}
        </button>
        <button
          v-if="ready.hasEarlier"
          :disabled="ready.loadingEarlier"
          @click="client.conversations.loadEarlier().catch(() => {})"
        >
          Load earlier messages
        </button>
        <ol>
          <li v-for="m in ready.conversation.messages" :key="m.id">
            <strong>{{ m.role }}</strong> {{ m.text }}
            <button
              v-for="attachment in m.attachments"
              :key="attachment.id"
              @click="download(attachment).catch(() => {})"
            >
              {{ attachment.name }}
            </button>
          </li>
        </ol>
        <form @submit.prevent="send().catch(() => {})">
          <label>Message<textarea v-model="text"></textarea></label
          ><label
            >Attachments<input
              ref="fileInput"
              type="file"
              multiple
              @change="chooseFiles" /></label
          ><button
            :disabled="
              ready.running ||
              ready.uploading ||
              ready.conversation.status === 'loading' ||
              !ready.modelId ||
              (!text.trim() && !files.length)
            "
          >
            Send</button
          ><button
            v-if="ready.running"
            type="button"
            @click="client.conversations.stop().catch(() => {})"
          >
            Stop
          </button>
        </form></template
      ></template
    >
  </main>
</template>
<style>
body {
  font: 16px system-ui;
  max-width: 800px;
  margin: 2rem auto;
  padding: 1rem;
}
label {
  display: block;
  margin: 1rem 0;
}
input,
textarea,
select,
button {
  font: inherit;
  padding: 0.5rem;
}
li {
  margin: 1rem 0;
}
</style>
