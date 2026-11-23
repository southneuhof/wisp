import { z } from 'zod'
import type { ChatDraftChanges, ChatDraftFile } from '../types.js'

const position = z.number().int().nonnegative().safe()
const workpieceId = position
const path = z.string().min(1)
const commitId = z.string().min(1)
const bytes = z.object({
  oid: z.string().regex(/^[0-9a-f]{40}$/),
  byteLength: position,
})
const textChange = z.array(
  z.union([position, z.tuple([position]).rest(z.string())]),
)
const fileChange = z.union([
  z.object({ edit: textChange }).strict(),
  z.object({ set: z.string() }).strict(),
  z.object({ remove: z.literal(true) }).strict(),
  z.object({ setBytes: bytes }).strict(),
])
const changeSchema = z
  .record(
    z.string().regex(/^(0|[1-9]\d*)$/),
    z.array(z.tuple([path, fileChange])),
  )
  .superRefine((change, ctx) => {
    for (const [id, entries] of Object.entries(change)) {
      if (
        !Number.isSafeInteger(Number(id)) ||
        new Set(entries.map(([name]) => name)).size !== entries.length
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid workpiece or duplicate file',
        })
      }
    }
  })
const pin = z.object({
  gadgetId: workpieceId,
  baseCommit: commitId,
  mergedCommit: commitId,
})
const metadataSchema = z.object({
  activeAgent: z.unknown().optional(),
  lastActive: z.date().optional(),
  proposedChangeWorkpieces: z.array(workpieceId).default([]),
  codeBase: z
    .object({
      generation: position,
      epoch: position.optional(),
      revision: position,
      pins: z.array(pin),
    })
    .default({ generation: 0, revision: 0, pins: [] }),
})
const changesMessage = z.object({
  type: z.literal('changes'),
  sequence: position,
  change: changeSchema.optional(),
  pins: z.array(pin.pick({ gadgetId: true, baseCommit: true })).default([]),
  watermark: z
    .object({ changesGeneration: position, throughRevision: position })
    .optional(),
})
const logSchema = z.discriminatedUnion('type', [
  changesMessage,
  z.object({
    type: z.literal('revert'),
    sequence: position,
    revertFrom: position,
  }),
  z.object({
    type: z.literal('merge'),
    sequence: position,
    mergeThrough: position,
    epochBoundary: z.literal(true).optional(),
  }),
])
const checkpointSchema = z.object({
  to: position,
  proposedChange: changeSchema.optional(),
})
const streamSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('editPreviewStart'),
    toolCallId: z.string().min(1),
    file: z.object({ workpieceId, filename: path }),
    textToReplace: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('editPreviewDelta'),
    toolCallId: z.string(),
    delta: z.string(),
  }),
  z.object({ type: z.literal('editPreviewClear'), toolCallId: z.string() }),
  z.object({ type: z.literal('toolCallFinished'), toolCallId: z.string() }),
  z.object({ type: z.literal('streamReset') }),
])
const commitEntry = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string() }),
  z.object({ kind: z.literal('absent') }),
  z.object({ kind: z.literal('blob'), blob: bytes }),
  z.object({ kind: z.literal('unreadable'), message: z.string() }),
])
const commitResponse = z.array(z.tuple([path, commitEntry]))
const listResponse = z.array(path)

type CodeChange = z.infer<typeof changeSchema>
type FileChange = z.infer<typeof fileChange>
type FileContent = z.infer<typeof commitEntry>
type Metadata = z.infer<typeof metadataSchema>
type LogRow = z.infer<typeof logSchema>
type Checkpoint = z.infer<typeof checkpointSchema>
type Preview = {
  workpieceId: number
  path: string
  textToReplace?: string
  text: string
  state: 'previewing' | 'queued'
}
type Read<T> = T | 'loading' | 'failed'
type FilePlan = {
  edits: FileChange[]
  previews: Preview[]
  changedInBase: boolean
}
type DraftPlan = Map<number, Map<string, FilePlan>>

const absent: FileContent = { kind: 'absent' }
const maxFilesPerRead = 64

function applyEdit(
  text: string,
  change: z.infer<typeof textChange>,
): string | undefined {
  const parts: string[] = []
  let offset = 0
  for (const section of change) {
    if (typeof section === 'number') {
      parts.push(text.slice(offset, offset + section))
      offset += section
    } else {
      const [length, ...lines] = section
      parts.push(lines.join('\n'))
      offset += length
    }
    if (offset > text.length) return undefined
  }
  return offset === text.length ? parts.join('') : undefined
}

function applyChange(
  content: FileContent | undefined,
  change: FileChange,
): FileContent | undefined {
  if ('set' in change) return { kind: 'text', text: change.set }
  if ('remove' in change) return absent
  if ('setBytes' in change) return { kind: 'blob', blob: change.setBytes }
  if (content?.kind !== 'text') return undefined
  const text = applyEdit(content.text, change.edit)
  return text === undefined ? undefined : { kind: 'text', text }
}

function applyPreview(
  content: FileContent | undefined,
  preview: Preview,
): FileContent | undefined {
  if (preview.textToReplace === undefined)
    return { kind: 'text', text: preview.text }
  if (content?.kind !== 'text') return undefined
  const at = content.text.indexOf(preview.textToReplace)
  if (at < 0 || content.text.indexOf(preview.textToReplace, at + 1) >= 0)
    return undefined
  return {
    kind: 'text',
    text:
      content.text.slice(0, at) +
      preview.text +
      content.text.slice(at + preview.textToReplace.length),
  }
}

function getFile(plan: DraftPlan, id: number, name: string): FilePlan {
  let workpiece = plan.get(id)
  if (!workpiece) {
    workpiece = new Map()
    plan.set(id, workpiece)
  }
  let file = workpiece.get(name)
  if (!file) {
    file = { edits: [], previews: [], changedInBase: false }
    workpiece.set(name, file)
  }
  return file
}

function addChange(plan: DraftPlan, change?: CodeChange): void {
  for (const [id, files] of Object.entries(change ?? {})) {
    for (const [name, edit] of files)
      getFile(plan, Number(id), name).edits.push(edit)
  }
}

function sameContent(before: FileContent, after: FileContent): boolean {
  switch (before.kind) {
    case 'absent':
      return after.kind === 'absent'
    case 'text':
      return after.kind === 'text' && before.text === after.text
    case 'blob':
      return after.kind === 'blob' && before.blob.oid === after.blob.oid
    case 'unreadable':
      return false
  }
}

function textSide(
  value?: FileContent,
): value is Extract<FileContent, { kind: 'text' | 'absent' }> {
  return value?.kind === 'text' || value?.kind === 'absent'
}

interface DraftTrackerOptions {
  readFilesAtCommit: (commit: string, paths: string[]) => Promise<unknown>
  listChangedPaths: (base: string, head: string) => Promise<unknown>
  onChange: () => void
}

function snapshotsEqual(
  left?: ChatDraftChanges,
  right?: ChatDraftChanges,
): boolean {
  if (!left || !right) return left === right
  return (
    left.pending === right.pending &&
    left.ready === right.ready &&
    left.files.length === right.files.length &&
    left.files.every((file, index) => {
      const other = right.files[index]
      return (
        other &&
        file.workpieceId === other.workpieceId &&
        file.path === other.path &&
        file.state === other.state &&
        file.before === other.before &&
        file.after === other.after &&
        file.binary === other.binary
      )
    })
  )
}

export class DraftTracker {
  #metadata?: Metadata
  #rows: LogRow[] = []
  #historyLoaded = false
  #malformedHistory = false
  #checkpoint?: Checkpoint
  #live = new Map<number, Map<number, CodeChange | undefined>>()
  #watermarks = new Map<number, number>()
  #previews = new Map<string, Preview>()
  #settledCalls = new Set<string>()
  #snapshot?: ChatDraftChanges
  #files = new Map<string, Map<string, Read<FileContent>>>()
  #changed = new Map<string, Read<string[]>>()
  #readQueue = new Map<string, string[]>()
  #scheduled = false
  #disposed = false

  constructor(private readonly options: DraftTrackerOptions) {}

  metadata(chat: unknown): void {
    const result = metadataSchema.safeParse(chat)
    if (!result.success) return
    const current = this.#metadata
    const next = result.data
    if (
      current &&
      (next.codeBase.generation < current.codeBase.generation ||
        (next.codeBase.generation === current.codeBase.generation &&
          next.codeBase.revision < current.codeBase.revision) ||
        (current.lastActive &&
          next.lastActive &&
          next.lastActive < current.lastActive))
    )
      return

    this.#metadata = next
    for (const generation of this.#live.keys()) {
      if (generation < next.codeBase.generation) this.#live.delete(generation)
    }
    for (const generation of this.#watermarks.keys()) {
      if (generation < next.codeBase.generation)
        this.#watermarks.delete(generation)
    }
    if (
      current &&
      (current.codeBase.generation !== next.codeBase.generation ||
        (current.activeAgent && !next.activeAgent))
    )
      this.resetPreviews()
    this.#retryReads()
    this.#schedule()
  }

  history<Row extends { type: string; sequence: number }>(
    rows: readonly Row[],
    checkpoint?: unknown,
  ): void {
    const boundary = checkpointSchema.optional().safeParse(checkpoint)
    this.#historyLoaded = true
    this.#malformedHistory = !boundary.success
    this.#checkpoint = boundary.success ? boundary.data : undefined
    this.#rows = []
    for (const row of rows) {
      if (
        row.type !== 'changes' &&
        row.type !== 'merge' &&
        row.type !== 'revert'
      )
        continue
      const parsed = logSchema.safeParse(row)
      if (parsed.success) {
        this.#rows.push(parsed.data)
        const watermark =
          parsed.data.type === 'changes' ? parsed.data.watermark : undefined
        if (
          watermark &&
          watermark.changesGeneration >=
            (this.#metadata?.codeBase.generation ?? 0)
        ) {
          const previous =
            this.#watermarks.get(watermark.changesGeneration) ?? 0
          this.#watermarks.set(
            watermark.changesGeneration,
            Math.max(previous, watermark.throughRevision),
          )
        }
      } else {
        this.#malformedHistory = true
      }
    }
    this.#rows.sort((left, right) => left.sequence - right.sequence)
    this.#retryReads()
    this.#schedule()
  }

  changeApplied(
    generation: number,
    revision: number,
    change: unknown,
    agentEdit = true,
  ): void {
    if (
      !position.safeParse(generation).success ||
      !position.safeParse(revision).success ||
      revision === 0
    )
      return
    if (this.#metadata && generation < this.#metadata.codeBase.generation)
      return
    if (revision <= (this.#watermarks.get(generation) ?? 0)) return
    let rows = this.#live.get(generation)
    if (!rows) {
      rows = new Map()
      this.#live.set(generation, rows)
    }
    if (rows.has(revision)) return
    const parsed = changeSchema.safeParse(change)
    rows.set(revision, parsed.success ? parsed.data : undefined)
    const currentGeneration = this.#metadata?.codeBase.generation
    if (
      parsed.success &&
      agentEdit &&
      (currentGeneration === undefined || currentGeneration === generation)
    ) {
      for (const [id, files] of Object.entries(parsed.data)) {
        for (const [name] of files) {
          for (const [callId, preview] of this.#previews) {
            if (
              preview.state === 'queued' &&
              preview.workpieceId === Number(id) &&
              preview.path === name
            ) {
              this.#settlePreview(callId)
              break
            }
          }
        }
      }
    }
    this.#schedule()
  }

  stream(event: unknown): void {
    const parsed = streamSchema.safeParse(event)
    if (!parsed.success) return
    const value = parsed.data
    if (value.type === 'streamReset') {
      this.resetPreviews()
      return
    }
    if (this.#settledCalls.has(value.toolCallId)) return
    const preview = this.#previews.get(value.toolCallId)
    switch (value.type) {
      case 'editPreviewStart':
        if (preview) return
        for (const older of this.#previews.values()) older.state = 'queued'
        this.#previews.set(value.toolCallId, {
          workpieceId: value.file.workpieceId,
          path: value.file.filename,
          textToReplace: value.textToReplace,
          text: '',
          state: 'previewing',
        })
        break
      case 'editPreviewDelta':
        if (!preview || preview.state !== 'previewing') return
        preview.text += value.delta
        break
      case 'editPreviewClear':
        this.#settlePreview(value.toolCallId)
        break
      case 'toolCallFinished':
        if (!preview) return
        preview.state = 'queued'
        break
    }
    this.#schedule()
  }

  resetPreviews(): void {
    const hadPreviews = this.#previews.size > 0
    this.#previews.clear()
    this.#settledCalls.clear()
    if (hadPreviews) this.#schedule()
  }

  getSnapshot(): ChatDraftChanges | undefined {
    return this.#scheduled && !this.#disposed ? this.#project() : this.#snapshot
  }

  dispose(): void {
    this.#disposed = true
    this.#snapshot = undefined
    this.#live.clear()
    this.#watermarks.clear()
    this.#previews.clear()
    this.#settledCalls.clear()
    this.#files.clear()
    this.#changed.clear()
    this.#readQueue.clear()
  }

  #settlePreview(callId: string): void {
    this.#previews.delete(callId)
    this.#settledCalls.add(callId)
  }

  #schedule(): void {
    if (this.#scheduled || this.#disposed) return
    this.#scheduled = true
    queueMicrotask(() => {
      this.#scheduled = false
      if (this.#disposed) return
      const next = this.#project()
      if (!snapshotsEqual(next, this.#snapshot)) {
        this.#snapshot = next
        this.options.onChange()
      }
      this.#flushReads()
    })
  }

  #project(): ChatDraftChanges | undefined {
    const metadata = this.#metadata
    const pendingIds = new Set(metadata?.proposedChangeWorkpieces)
    const pending = pendingIds.size > 0
    if (!pending && this.#previews.size === 0 && this.#live.size === 0)
      return undefined
    const codeBase = metadata?.codeBase
    const pins = new Map(codeBase?.pins.map((entry) => [entry.gadgetId, entry]))
    const generation = codeBase?.generation ?? 0
    const epoch = codeBase?.epoch
    const plan: DraftPlan = new Map()
    let ready = !!metadata && this.#historyLoaded && !this.#malformedHistory
    let rowsThrough = 0
    const batches: z.infer<typeof changesMessage>[] = []
    let checkpoint = this.#checkpoint
    if (
      checkpoint &&
      ((epoch !== undefined && epoch >= checkpoint.to) ||
        (this.#rows[0] !== undefined && this.#rows[0].sequence < checkpoint.to))
    )
      checkpoint = undefined
    for (const row of this.#rows) {
      if (epoch !== undefined && row.sequence < epoch) continue
      switch (row.type) {
        case 'changes':
          batches.push(row)
          break
        case 'revert': {
          const index = batches.findIndex(
            (batch) => batch.sequence >= row.revertFrom,
          )
          if (index !== -1) batches.splice(index)
          // A crossing revert can invalidate an earlier checkpoint. Its server-side replacement
          // has to be fetched together with the updated history.
          if (checkpoint && row.revertFrom < checkpoint.to) ready = false
          break
        }
        case 'merge':
          if (
            row.epochBoundary &&
            (epoch === undefined || row.sequence > epoch)
          )
            ready = false
          break
      }
    }
    const declaredBases = new Map<number, string>()
    addChange(plan, checkpoint?.proposedChange)
    for (const row of batches) {
      for (const declaration of row.pins) {
        plan.delete(declaration.gadgetId)
        declaredBases.set(declaration.gadgetId, declaration.baseCommit)
      }
      addChange(plan, row.change)
      if (row.watermark?.changesGeneration === generation) {
        rowsThrough = Math.max(rowsThrough, row.watermark.throughRevision)
      } else if (
        row.watermark &&
        row.watermark.changesGeneration > generation
      ) {
        ready = false
      }
    }

    const live = this.#live.get(generation)
    const liveTail = [...(live?.entries() ?? [])].sort(
      ([left], [right]) => left - right,
    )
    let projectedRevision = rowsThrough
    for (const [revision, change] of liveTail) {
      if (revision <= rowsThrough) {
        live?.delete(revision)
        continue
      }
      if (revision !== projectedRevision + 1 || !change) {
        ready = false
        break
      }
      addChange(plan, change)
      projectedRevision = revision
    }
    const metadataRevision = codeBase?.revision ?? 0
    if (
      metadataRevision !== projectedRevision ||
      [...this.#live.keys()].some((value) => value > generation)
    ) {
      ready = false
    }
    if (
      [...declaredBases].some(([id, base]) => pins.get(id)?.baseCommit !== base)
    ) {
      ready = false
    }
    const revisionsKnown = ready
    for (const preview of this.#previews.values()) {
      getFile(plan, preview.workpieceId, preview.path).previews.push(preview)
    }
    for (const pinState of pins.values()) {
      if (
        !pendingIds.has(pinState.gadgetId) ||
        pinState.baseCommit === pinState.mergedCommit
      )
        continue
      const paths = this.#differentPaths(
        pinState.mergedCommit,
        pinState.baseCommit,
      )
      if (!paths) {
        ready = false
        continue
      }
      for (const name of paths)
        getFile(plan, pinState.gadgetId, name).changedInBase = true
    }
    const files: ChatDraftFile[] = []
    for (const [id, workpiece] of plan) {
      const pinned = pins.get(id)
      const proposed = pendingIds.has(id)
      const knownNew = proposed && !pinned && revisionsKnown
      for (const [name, file] of workpiece) {
        if (!proposed && file.previews.length === 0) continue
        const before = pinned
          ? this.#readFile(pinned.mergedCommit, name)
          : knownNew
            ? absent
            : undefined
        let after =
          pinned && pinned.baseCommit !== pinned.mergedCommit
            ? this.#readFile(pinned.baseCommit, name)
            : before
        for (const edit of file.edits) after = applyChange(after, edit)
        if (proposed && (!before || !after)) ready = false
        for (const preview of file.previews)
          after = applyPreview(after, preview)
        if (
          revisionsKnown &&
          !file.changedInBase &&
          file.previews.length === 0 &&
          before &&
          after &&
          sameContent(before, after)
        )
          continue

        const preview = file.previews.at(-1)
        const row: ChatDraftFile = {
          workpieceId: id,
          path: name,
          state: preview?.state ?? 'applied',
          ...(revisionsKnown && textSide(before) && textSide(after)
            ? {
                ...(before.kind === 'text' ? { before: before.text } : {}),
                ...(after.kind === 'text' ? { after: after.text } : {}),
              }
            : {}),
          ...(revisionsKnown &&
          ((file.edits.some((edit) => 'setBytes' in edit) &&
            after?.kind === 'blob') ||
            [before, after].some(
              (value) =>
                value?.kind === 'unreadable' &&
                value.message === `${name} is not a text file`,
            ))
            ? { binary: true }
            : {}),
        }
        files.push(row)
      }
    }
    if (!pending && files.length === 0) return undefined
    return {
      pending,
      ready: pending && ready && this.#previews.size === 0,
      files,
    }
  }

  #readFile(commit: string, name: string): FileContent | undefined {
    let cache = this.#files.get(commit)
    if (!cache) {
      cache = new Map()
      this.#files.set(commit, cache)
    }
    const value = cache.get(name)
    if (typeof value === 'object') return value
    if (!value) {
      cache.set(name, 'loading')
      const pending = this.#readQueue.get(commit) ?? []
      pending.push(name)
      this.#readQueue.set(commit, pending)
    }
    return undefined
  }

  #flushReads(): void {
    for (const [commit, names] of this.#readQueue) {
      for (let index = 0; index < names.length; index += maxFilesPerRead) {
        void this.#readFiles(
          commit,
          names.slice(index, index + maxFilesPerRead),
        )
      }
    }
    this.#readQueue.clear()
  }

  async #readFiles(commit: string, names: string[]): Promise<void> {
    const cache = this.#files.get(commit)
    if (!cache) return
    let remaining = names
    try {
      while (!this.#disposed && remaining.length > 0) {
        const result = commitResponse.safeParse(
          await this.options.readFilesAtCommit(commit, remaining),
        )
        if (this.#disposed) return
        if (!result.success) break
        const values = new Map(result.data)
        const omitted = remaining.filter((name) => {
          const value = values.get(name)
          if (!value) return true
          cache.set(name, value)
          return false
        })
        if (omitted.length === remaining.length) break
        remaining = omitted
      }
    } catch {
      // Preserve successful entries from earlier batches and retry the unread paths on refresh.
    }
    if (!this.#disposed) {
      for (const name of remaining) cache.set(name, 'failed')
      this.#schedule()
    }
  }

  #differentPaths(base: string, head: string): string[] | undefined {
    const key = JSON.stringify([base, head])
    const value = this.#changed.get(key)
    if (Array.isArray(value)) return value
    if (!value) {
      this.#changed.set(key, 'loading')
      void this.options.listChangedPaths(base, head).then(
        (response) => {
          if (this.#disposed) return
          const result = listResponse.safeParse(response)
          this.#changed.set(key, result.success ? result.data : 'failed')
          this.#schedule()
        },
        () => {
          if (this.#disposed) return
          this.#changed.set(key, 'failed')
        },
      )
    }
    return undefined
  }

  #retryReads(): void {
    for (const cache of this.#files.values()) {
      for (const [name, value] of cache) {
        if (value === 'failed') cache.delete(name)
      }
    }
    for (const [key, value] of this.#changed) {
      if (value === 'failed') this.#changed.delete(key)
    }
  }
}
