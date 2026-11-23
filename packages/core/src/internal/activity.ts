import type { ChatActivity } from '../types.js'
import type { NativeMessage, NativeStreamEvent } from './protocol.js'

const toolTitles: Record<string, string> = {
  readFile: 'Read file',
  writeFile: 'Write file',
  editFile: 'Edit file',
  grep: 'Search files',
  executeCode: 'Run code',
  describeBinding: 'Inspect connection',
  requestConnection: 'Request a connection',
  webFetch: 'Fetch web page',
  setBindingHook: 'Set binding hook',
  setGadgetBinding: 'Connect a gadget',
  saveCapsuleAsBinding: 'Save binding',
  createGadget: 'Create gadget',
  createWorktree: 'Create worktree',
  createExternalResource: 'Create external resource',
  observeUserChanges: 'Check for user changes',
  listBlueprints: 'List blueprints',
  listConnectableResources: 'List connectable resources',
}

export function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : undefined
}

function title(toolName: string, filename?: string): string {
  if (filename) {
    if (toolName === 'readFile') return `Read ${filename}`
    if (toolName === 'editFile') return `Edit ${filename}`
    if (toolName === 'writeFile') return `Write ${filename}`
  }
  return (
    (Object.hasOwn(toolTitles, toolName) ? toolTitles[toolName] : undefined) ??
    toolName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^\w/, (c) => c.toUpperCase())
  )
}

function actionFields(fields: unknown) {
  if (!Array.isArray(fields)) return undefined
  return fields.flatMap((raw: unknown) => {
    const field = record(raw)
    const label = string(field?.label)
    if (!field || !label) return []
    let value = typeof field.value === 'string' ? field.value : undefined
    if (Array.isArray(field.items))
      value = field.items.filter((item) => typeof item === 'string').join('\n')
    if (field.kind === 'file' && typeof field.name === 'string') {
      const size = number(field.size)
      const digest = string(field.sha256)
      value = [
        field.name,
        size === undefined ? undefined : `${size.toLocaleString()} bytes`,
        string(field.mediaType),
        digest && `SHA-256 ${digest}`,
      ]
        .filter(Boolean)
        .join(' · ')
    }
    const length = record(field.truncated)
    if (
      length &&
      number(length.shownBytes) !== undefined &&
      number(length.totalBytes) !== undefined
    )
      value = [
        value,
        `Showing ${length.shownBytes} of ${length.totalBytes} bytes.`,
      ]
        .filter(Boolean)
        .join('\n')
    return value === undefined
      ? []
      : [
          {
            label,
            value,
            ...(field.kind === 'json' && { kind: 'json' as const }),
          },
        ]
  })
}

type RequestActivity = Extract<ChatActivity, { kind: 'request' }>

function actionActivity(
  raw: unknown,
  sequence?: number,
): RequestActivity | undefined {
  const action = record(raw)
  if (action?.type !== 'action') return
  const id = number(action.id)
  const state = action.state
  if (
    id === undefined ||
    (state !== 'pending' && state !== 'approved' && state !== 'rejected')
  )
    return
  const description = record(action.description)
  const resource = string(action.resourceTitle)
  const fields = actionFields(description?.fields)
  const pushes =
    Array.isArray(description?.pushedCommits) &&
    description.pushedCommits.length > 0
  const incomplete = !!description && description.descriptionIsComplete !== true
  const details = [
    string(description?.description),
    pushes ? 'Review the commits in CloudflareOS before approving.' : undefined,
  ]
    .filter(Boolean)
    .join('\n\n')
  return {
    id: `action:${id}`,
    sequence,
    kind: 'request',
    title: string(description?.title) ?? resource ?? 'Action approval',
    detail: details || undefined,
    incomplete,
    fields: resource
      ? [{ label: 'Resource', value: resource }, ...(fields ?? [])]
      : fields,
    state,
    request: {
      kind: 'action',
      id,
      requiresSetup: action.creation === true || pushes,
    },
  }
}

function currentRequest(
  previous: RequestActivity | undefined,
  next: RequestActivity,
) {
  // A history read can finish after a newer subscription upsert or decision acknowledgement.
  const request =
    previous && previous.state !== 'pending' && next.state === 'pending'
      ? previous
      : next
  return { ...request, sequence: next.sequence ?? previous?.sequence }
}

function nativeRequest(row: NativeMessage): RequestActivity | undefined {
  const id = string(row.requestId)
  const state = row.state
  if (!id) return
  if (
    row.type === 'connectionRequest' &&
    (state === 'pending' || state === 'accepted' || state === 'denied')
  ) {
    const vendor = string(row.vendorName)
    const resource = string(row.resourceTitle)
    const url = string(row.resourceUrl)
    return {
      id: `connection:${id}`,
      sequence: row.sequence,
      kind: 'request',
      request: { kind: 'connection', id },
      state:
        state === 'accepted'
          ? 'approved'
          : state === 'denied'
            ? 'rejected'
            : 'pending',
      title: vendor ? `Connect ${vendor}` : 'Connect a resource',
      detail: string(row.reason),
      fields: [
        ...(resource ? [{ label: 'Resource', value: resource }] : []),
        ...(url ? [{ label: 'URL', value: url }] : []),
      ],
    }
  }
  if (
    row.type === 'webFetchRequest' &&
    (state === 'pending' || state === 'approved' || state === 'denied')
  ) {
    const url = string(row.url)
    return {
      id: `web:${id}`,
      sequence: row.sequence,
      kind: 'request',
      request: { kind: 'web', id },
      state: state === 'denied' ? 'rejected' : state,
      title: 'Fetch web page',
      detail:
        'CloudflareOS restricted this request. Approve only if the URL and any redirects contain no restricted data.',
      fields: url ? [{ label: 'URL', value: url }] : [],
    }
  }
}

type ToolActivity = Extract<ChatActivity, { kind: 'tool' }>
type ReasoningActivity = Extract<ChatActivity, { kind: 'reasoning' }>

function nativeTool(raw: unknown, sequence: number): ToolActivity | undefined {
  const tool = record(raw)
  const toolName = string(tool?.toolName)
  const id = string(tool?.toolCallId)
  if (!toolName || !id) return
  const input = record(tool?.input)
  const error = string(tool?.error)
  const output = string(tool?.output)
  return {
    id: `tool:${id}`,
    sequence,
    kind: 'tool',
    title: title(toolName, string(input?.filename)),
    state: error ? 'failed' : 'complete',
    detail:
      error ??
      (toolName === 'describeBinding'
        ? output?.match(/^Title: ([^\r\n]+)/m)?.[1]
        : (output ?? string(input?.url))),
  }
}

export class ActivityTracker {
  #saved = new Map<number, ChatActivity[]>()
  #requests = new Map<string, RequestActivity>()
  #actionSequences = new Map<number, number>()
  #reasoning: ReasoningActivity | undefined
  #savedTools = new Set<string>()
  #running = new Map<string, { toolName: string; item: ToolActivity }>()
  #compacting = false
  #compactNotice = false

  getSnapshot(): ChatActivity[] {
    const activity = [...this.#saved.values()]
      .flat()
      .concat([...this.#requests.values()])
    activity.sort(
      (left, right) =>
        (left.sequence ?? Infinity) - (right.sequence ?? Infinity),
    )
    if (this.#reasoning) activity.push(this.#reasoning)
    activity.push(...[...this.#running.values()].map(({ item }) => item))
    if (this.#compacting)
      activity.push({
        id: 'compaction',
        kind: 'tool',
        title: 'Summarize earlier messages',
        state: 'running',
      })
    if (this.#compactNotice)
      activity.push({
        id: 'compaction',
        kind: 'notice',
        text: 'No earlier messages to summarize.',
      })
    return activity
  }

  #upsert(item: RequestActivity) {
    this.#requests.set(
      item.id,
      currentRequest(this.#requests.get(item.id), item),
    )
  }

  actionLog(raw: unknown) {
    const activity = actionActivity(raw)
    if (activity && activity.request.kind === 'action')
      this.#upsert({
        ...activity,
        sequence: this.#actionSequences.get(activity.request.id),
      })
  }

  request(id: string): RequestActivity | undefined {
    return this.#requests.get(id)
  }

  decided(id: string, state: 'approved' | 'rejected') {
    const item = this.#requests.get(id)
    if (item?.state === 'pending') this.#upsert({ ...item, state })
  }

  message(row: NativeMessage, live = false) {
    const items: ChatActivity[] = []
    const id = `os:${row.chatId}:${row.sequence}`
    if (row.type === 'message' && row.author?.type === 'agent') {
      const reasoning = string(row.reasoning)
      if (reasoning)
        items.push({
          id: `${id}:reasoning`,
          sequence: row.sequence,
          kind: 'reasoning',
          text: reasoning,
        })
      if (Array.isArray(row.toolCalls)) {
        for (const raw of row.toolCalls) {
          const tool = nativeTool(raw, row.sequence)
          if (tool) {
            items.push(tool)
            this.#savedTools.add(tool.id)
            this.#running.delete(tool.id)
          }
        }
      }
      if (live) this.#reasoning = undefined
    }
    if (row.type === 'action') {
      const actionId = number(row.actionId)
      if (actionId !== undefined)
        this.#actionSequences.set(actionId, row.sequence)
      const item = actionActivity(row.actionLog, row.sequence)
      if (item) this.#upsert(item)
      else {
        const known = this.#requests.get(`action:${actionId}`)
        if (known) this.#upsert({ ...known, sequence: row.sequence })
      }
    }
    const request = nativeRequest(row)
    if (request) this.#upsert(request)
    if (row.type === 'error') {
      items.push(
        row.code === 'stopped'
          ? {
              id,
              sequence: row.sequence,
              kind: 'notice',
              text: 'Response stopped.',
            }
          : {
              id,
              sequence: row.sequence,
              kind: 'error',
              title: 'Response interrupted',
              detail: row.message,
            },
      )
      if (live) this.reset()
    }
    if (items.length) this.#saved.set(row.sequence, items)
    else this.#saved.delete(row.sequence)
  }

  stream(event: NativeStreamEvent) {
    const id = string(event.toolCallId)
    const delta = event.delta ?? ''
    if (event.type === 'streamReset') this.reset()
    if (event.type === 'compacting') {
      this.#compacting = true
      this.#compactNotice = false
    }
    if (event.type === 'compacted') {
      this.#compacting = false
      this.#compactNotice = event.nothingToCompact === true
    }
    if (event.type === 'textDelta') this.#compactNotice = false
    if (event.type === 'reasoningDelta' && delta) {
      this.#reasoning = {
        id: 'stream:reasoning',
        kind: 'reasoning',
        text: (this.#reasoning?.text ?? '') + delta,
      }
    }
    if (!id) return
    const key = `tool:${id}`
    if (this.#savedTools.has(key)) return
    const toolName = string(event.toolName)
    if (event.type === 'toolCallStarted' && toolName && !this.#running.has(key))
      this.#running.set(key, {
        toolName,
        item: {
          id: key,
          kind: 'tool',
          title: title(toolName),
          state: 'running',
        },
      })
    const entry = this.#running.get(key)
    if (!entry) return
    if (event.type === 'toolCallTarget') {
      const filename = string(record(event.file)?.filename)
      this.#running.set(key, {
        ...entry,
        item: { ...entry.item, title: title(entry.toolName, filename) },
      })
    }
    if (
      (event.type === 'toolCodeDelta' || event.type === 'toolOutputDelta') &&
      delta &&
      entry.toolName !== 'describeBinding'
    )
      this.#running.set(key, {
        ...entry,
        item: { ...entry.item, detail: (entry.item.detail ?? '') + delta },
      })
  }

  reset(clearNotice = true) {
    this.#reasoning = undefined
    this.#running.clear()
    this.#compacting = false
    if (clearNotice) this.#compactNotice = false
  }
}
