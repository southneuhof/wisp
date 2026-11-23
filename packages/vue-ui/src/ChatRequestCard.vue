<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChatClientError } from '@southneuhof/wisp-core'
import type { ChatActivity } from '@southneuhof/wisp-core'
import ChatEventCard from './ChatEventCard.vue'
import { useChatMessages } from './useChatMessages.js'

const props = defineProps<{
  entry: Extract<ChatActivity, { kind: 'request' }>
  nativeUrl: string
  decide?: (id: string, decision: 'approve' | 'reject') => Promise<void>
}>()

const t = useChatMessages()
const submitting = ref(false)
const error = ref('')

type Field = { label: string; value: string }

function label(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\p{L}/u, (letter) => letter.toUpperCase())
}

function argumentsFields(input: unknown, path: string[] = []): Field[] {
  if (
    input &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    path.length < 5
  ) {
    const fields = Object.entries(input)
    if (fields.length)
      return fields.flatMap(([key, value]) =>
        argumentsFields(value, [...path, label(key)]),
      )
  }
  return [
    {
      label: path.join(' / ') || t.value.arguments,
      value: typeof input === 'string' ? input : JSON.stringify(input),
    },
  ]
}

const mcp = computed(() => {
  const fields = props.entry.fields ?? []
  const server = fields.find((field) => field.label === 'Server')?.value
  const tool = fields.find((field) => field.label === 'Tool')?.value
  const endpoint = fields.find((field) => field.label === 'Endpoint')
  const args = fields.find(
    (field) => field.label === 'Arguments' && field.kind === 'json',
  )
  if (!server || !tool || !endpoint || !args) return

  let parameters: Field[] = [args]
  try {
    parameters = argumentsFields(JSON.parse(args.value))
  } catch {}

  const prefix = server.split(/[-_]/)[0] + '_'
  const toolLabel = label(
    tool.startsWith(prefix) ? tool.slice(prefix.length) : tool,
  )
  const origin = URL.parse(endpoint.value)?.origin
  return {
    title: toolLabel || props.entry.title,
    fields: [
      ...parameters,
      ...fields.filter(
        (field) =>
          !['Server', 'Tool', 'Endpoint', 'Arguments', 'Resource'].includes(
            field.label,
          ),
      ),
    ],
    technical: [
      { label: t.value.server, value: server },
      { label: t.value.tool, value: tool },
      ...(origin && origin !== 'null'
        ? [{ label: t.value.destination, value: origin }]
        : []),
      args,
    ],
  }
})

const fields = computed(() => mcp.value?.fields ?? props.entry.fields)
const requiresNative = computed(() => {
  const request = props.entry.request
  return (
    request.kind === 'connection' ||
    (request.kind === 'action' && request.requiresSetup)
  )
})
const status = computed(() => {
  if (props.entry.state === 'approved') return t.value.approved
  if (props.entry.state === 'rejected') return t.value.rejected
  return t.value.waitingForApproval
})

async function respond(decision: 'approve' | 'reject') {
  if (!props.decide || submitting.value || props.entry.state !== 'pending')
    return
  submitting.value = true
  error.value = ''
  try {
    await props.decide(props.entry.id, decision)
  } catch (cause) {
    if (props.entry.state !== 'pending') return
    error.value =
      cause instanceof ChatClientError && cause.code !== 'operation'
        ? cause.message
        : t.value.decideError
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <ChatEventCard :title="mcp?.title ?? entry.title" :status="status">
    <p v-if="entry.detail && !mcp" class="wisp-request-detail">
      {{ entry.detail }}
    </p>
    <p
      v-if="entry.incomplete && entry.state === 'pending'"
      class="wisp-request-detail"
    >
      {{ t.incompleteApproval }}
    </p>
    <dl v-if="fields?.length" class="wisp-request-fields">
      <div v-for="(field, index) in fields" :key="index">
        <dt>{{ field.label }}</dt>
        <dd>{{ field.value }}</dd>
      </div>
    </dl>
    <details v-if="mcp" class="wisp-request-technical">
      <summary>{{ t.toolDetails }}</summary>
      <p v-if="entry.detail" class="wisp-request-detail">{{ entry.detail }}</p>
      <dl class="wisp-request-fields">
        <div v-for="field in mcp.technical" :key="field.label">
          <dt>{{ field.label }}</dt>
          <dd>{{ field.value }}</dd>
        </div>
      </dl>
    </details>
    <p
      v-if="error && entry.state === 'pending'"
      class="wisp-text-error"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-if="entry.state === 'pending'" #actions>
      <button
        v-if="decide"
        type="button"
        class="wisp-event-button"
        :disabled="submitting"
        @click="respond('reject')"
      >
        {{ t.reject }}
      </button>
      <a
        v-if="requiresNative || !decide || error"
        class="wisp-event-button wisp-event-primary"
        :href="nativeUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t.openCloudflare }}
      </a>
      <button
        v-else
        type="button"
        class="wisp-event-button wisp-event-primary"
        :disabled="submitting"
        @click="respond('approve')"
      >
        {{ t.approve }}
      </button>
    </template>
  </ChatEventCard>
</template>

<style scoped>
.wisp-request-detail {
  color: var(--wisp-muted);
  white-space: pre-line;
}

.wisp-request-fields {
  display: grid;
  gap: 6px;
  margin: 12px 0;
  max-height: 12rem;
  overflow: auto;
}

.wisp-request-fields dt {
  color: var(--wisp-muted);
  font-size: 0.75rem;
}

.wisp-request-fields dd {
  margin: 0;
  white-space: pre-wrap;
}

.wisp-request-technical {
  color: var(--wisp-muted);
  font-size: 0.8125rem;
}

.wisp-request-technical summary {
  width: fit-content;
  cursor: pointer;
}
</style>
