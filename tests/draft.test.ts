import { describe, expect, it, vi } from 'vitest'
import { DraftTracker } from '../packages/core/src/internal/draft.js'

const pin = {
  gadgetId: 1,
  baseCommit: 'draft-base',
  mergedCommit: 'accepted-head',
}
const defaultPin = { ...pin, mergedCommit: pin.baseCommit }

function metadata(
  revision: number,
  options: {
    pins?: (typeof pin)[]
    pending?: number[]
    generation?: number
    epoch?: number
  } = {},
) {
  return {
    activeAgent: { type: 'agent' },
    proposedChangeWorkpieces: options.pending ?? [1],
    codeBase: {
      generation: options.generation ?? 1,
      revision,
      epoch: options.epoch,
      pins: options.pins ?? [defaultPin],
    },
  }
}

function fixture(values: Record<string, Record<string, unknown>> = {}) {
  const readFiles = vi.fn(async (commit: string, paths: string[]) =>
    paths.map((path) => [path, values[commit]?.[path] ?? { kind: 'absent' }]),
  )
  const listChanged = vi.fn<() => Promise<string[]>>(async () => [])
  const onChange = vi.fn()
  const tracker = new DraftTracker({
    readFilesAtCommit: readFiles,
    listChangedPaths: listChanged,
    onChange,
  })
  return { tracker, readFiles, listChanged, onChange }
}

function preview(
  tracker: DraftTracker,
  toolCallId: string,
  filename: string,
  delta: string,
  textToReplace?: string,
) {
  tracker.stream({
    type: 'editPreviewStart',
    toolCallId,
    file: { workpieceId: 1, filename },
    textToReplace,
  })
  tracker.stream({ type: 'editPreviewDelta', toolCallId, delta })
}

describe('CloudflareOS draft changes', () => {
  it('folds preview calls, clears a failed call and replaces only the oldest matching preview on each agent row', async () => {
    const { tracker, readFiles } = fixture({
      'draft-base': {
        'a.txt': { kind: 'text', text: 'prefix a suffix' },
        'b.txt': { kind: 'text', text: 'original' },
      },
    })
    tracker.metadata(metadata(1))
    const firstBatch = {
      type: 'changes',
      sequence: 1,
      change: { 1: [['b.txt', { set: 'pending' }]] },
      pins: [defaultPin],
      watermark: { changesGeneration: 1, throughRevision: 1 },
    }
    tracker.history([firstBatch])
    preview(tracker, 'first', 'a.txt', 'b', 'a suffix')
    preview(tracker, 'second', 'a.txt', 'c', 'prefix')
    preview(tracker, 'failed', 'b.txt', 'invalid preview')
    tracker.stream({ type: 'toolCallFinished', toolCallId: 'failed' })

    await vi.waitFor(() =>
      expect(tracker.getSnapshot()?.files).toEqual([
        {
          workpieceId: 1,
          path: 'b.txt',
          before: 'original',
          after: 'invalid preview',
          state: 'queued',
        },
        {
          workpieceId: 1,
          path: 'a.txt',
          before: 'prefix a suffix',
          after: 'c b',
          state: 'queued',
        },
      ]),
    )
    expect(tracker.getSnapshot()?.ready).toBe(false)
    expect(readFiles).toHaveBeenCalledOnce()

    tracker.stream({ type: 'editPreviewClear', toolCallId: 'failed' })
    tracker.changeApplied(1, 1, firstBatch.change)
    tracker.changeApplied(1, 2, { 1: [['a.txt', { edit: [7, [8, 'b']] }]] })
    tracker.metadata(metadata(2))
    expect(tracker.getSnapshot()?.files).toContainEqual({
      workpieceId: 1,
      path: 'a.txt',
      before: 'prefix a suffix',
      after: 'c b',
      state: 'queued',
    })

    tracker.changeApplied(1, 2, { 1: [['a.txt', { set: 'duplicate' }]] })
    tracker.changeApplied(1, 3, { 1: [['a.txt', { edit: [[6, 'c'], 2] }]] })
    tracker.metadata(metadata(3))
    expect(tracker.getSnapshot()).toEqual({
      pending: true,
      ready: true,
      files: [
        {
          workpieceId: 1,
          path: 'b.txt',
          before: 'original',
          after: 'pending',
          state: 'applied',
        },
        {
          workpieceId: 1,
          path: 'a.txt',
          before: 'prefix a suffix',
          after: 'c b',
          state: 'applied',
        },
      ],
    })

    tracker.history([
      firstBatch,
      {
        type: 'changes',
        sequence: 3,
        change: { 1: [['a.txt', { edit: [[15, 'c b']] }]] },
        watermark: { changesGeneration: 1, throughRevision: 3 },
      },
    ])
    expect(tracker.getSnapshot()?.files.at(-1)?.after).toBe('c b')
    tracker.dispose()
  })

  it('waits for missing revisions and applies edits in UTF-16 order even if later rows arrived first', async () => {
    const { tracker } = fixture({
      'draft-base': { 'a.txt': { kind: 'text', text: '😀a\r\nlast' } },
    })
    tracker.metadata(metadata(3))
    tracker.history([
      {
        type: 'changes',
        sequence: 4,
        change: { 1: [['a.txt', { edit: [2, [1, 'b'], 6] }]] },
        pins: [defaultPin],
        watermark: { changesGeneration: 1, throughRevision: 1 },
      },
    ])
    tracker.changeApplied(1, 3, { 1: [['a.txt', { edit: [9, [0, ' done']] }]] })
    expect(tracker.getSnapshot()).toEqual({
      pending: true,
      ready: false,
      files: [{ workpieceId: 1, path: 'a.txt', state: 'applied' }],
    })

    tracker.changeApplied(1, 2, { 1: [['a.txt', { edit: [[2, '😎'], 7] }]] })
    await vi.waitFor(() =>
      expect(tracker.getSnapshot()).toEqual({
        pending: true,
        ready: true,
        files: [
          {
            workpieceId: 1,
            path: 'a.txt',
            before: '😀a\r\nlast',
            after: '😎b\r\nlast done',
            state: 'applied',
          },
        ],
      }),
    )
    tracker.dispose()
  })

  it('rebuilds re-rooted paths against accepted mainline and clears history after an epoch rolls over', async () => {
    const { tracker, listChanged } = fixture({
      'accepted-head': {
        'removed.txt': { kind: 'text', text: '' },
        'image.bin': {
          kind: 'unreadable',
          message: 'image.bin is not a text file',
        },
      },
      'draft-base': { 'new.txt': { kind: 'text', text: '' } },
    })
    listChanged.mockResolvedValueOnce(['removed.txt', 'new.txt', 'image.bin'])
    tracker.metadata(metadata(0, { pins: [pin], generation: 2 }))
    tracker.history([
      {
        type: 'changes',
        sequence: 1,
        change: { 1: [['stale.txt', { set: 'old edit' }]] },
      },
      { type: 'changes', sequence: 2, pins: [pin] },
      {
        type: 'changes',
        sequence: 3,
        change: { 1: [['reverted.txt', { set: 'discarded' }]] },
      },
      { type: 'revert', sequence: 4, revertFrom: 3 },
    ])

    await vi.waitFor(() =>
      expect(tracker.getSnapshot()).toEqual({
        pending: true,
        ready: true,
        files: [
          { workpieceId: 1, path: 'removed.txt', before: '', state: 'applied' },
          { workpieceId: 1, path: 'new.txt', after: '', state: 'applied' },
          { workpieceId: 1, path: 'image.bin', state: 'applied', binary: true },
        ],
      }),
    )

    tracker.metadata(
      metadata(0, { pending: [], pins: [], generation: 3, epoch: 5 }),
    )
    expect(tracker.getSnapshot()).toBeUndefined()
    tracker.dispose()
  })

  it('does not treat a preview without a verified base or a malformed revision as an addition', () => {
    const { tracker } = fixture()
    tracker.metadata(metadata(0, { pending: [], pins: [] }))
    tracker.history([])
    preview(tracker, 'first', '__proto__', 'test')
    expect(tracker.getSnapshot()).toEqual({
      pending: false,
      ready: false,
      files: [{ workpieceId: 1, path: '__proto__', state: 'previewing' }],
    })

    tracker.resetPreviews()
    tracker.metadata(metadata(1, { pending: [1], pins: [] }))
    tracker.changeApplied(1, 1, {
      1: [
        ['__proto__', { set: '' }],
        ['__proto__', { set: 'bad' }],
      ],
    })
    expect(tracker.getSnapshot()).toEqual({
      pending: true,
      ready: false,
      files: [],
    })
    tracker.history([
      {
        type: 'changes',
        sequence: 1,
        change: { 1: [['__proto__', { set: '' }]] },
        watermark: { changesGeneration: 1, throughRevision: 1 },
      },
    ])
    expect(tracker.getSnapshot()).toEqual({
      pending: true,
      ready: true,
      files: [
        { workpieceId: 1, path: '__proto__', after: '', state: 'applied' },
      ],
    })
    tracker.dispose()
  })

  it('re-requests omitted commit entries without treating them as absent', async () => {
    const { tracker, readFiles } = fixture()
    readFiles.mockResolvedValueOnce([
      ['one.txt', { kind: 'text', text: 'old' }],
    ])
    readFiles.mockResolvedValueOnce([
      ['two.txt', { kind: 'text', text: 'other' }],
    ])
    tracker.metadata(metadata(1))
    tracker.history([
      {
        type: 'changes',
        sequence: 1,
        change: {
          1: [
            ['one.txt', { set: 'new' }],
            ['two.txt', { set: 'different' }],
          ],
        },
        pins: [defaultPin],
        watermark: { changesGeneration: 1, throughRevision: 1 },
      },
    ])

    await vi.waitFor(() =>
      expect(tracker.getSnapshot()).toEqual({
        pending: true,
        ready: true,
        files: [
          {
            workpieceId: 1,
            path: 'one.txt',
            before: 'old',
            after: 'new',
            state: 'applied',
          },
          {
            workpieceId: 1,
            path: 'two.txt',
            before: 'other',
            after: 'different',
            state: 'applied',
          },
        ],
      }),
    )
    expect(readFiles.mock.calls).toEqual([
      ['draft-base', ['one.txt', 'two.txt']],
      ['draft-base', ['two.txt']],
    ])
    tracker.dispose()
  })

  it('waits for older history if a checkpoint does not establish a live revision watermark', async () => {
    const { tracker } = fixture({
      'draft-base': { 'a.txt': { kind: 'text', text: 'original' } },
    })
    const change = { 1: [['a.txt', { set: 'draft' }]] }
    tracker.metadata(metadata(1))
    tracker.history([], { to: 5, proposedChange: change })
    expect(tracker.getSnapshot()).toEqual({
      pending: true,
      ready: false,
      files: [{ workpieceId: 1, path: 'a.txt', state: 'applied' }],
    })

    tracker.history([
      {
        type: 'changes',
        sequence: 3,
        change,
        pins: [defaultPin],
        watermark: { changesGeneration: 1, throughRevision: 1 },
      },
    ])
    await vi.waitFor(() =>
      expect(tracker.getSnapshot()).toEqual({
        pending: true,
        ready: true,
        files: [
          {
            workpieceId: 1,
            path: 'a.txt',
            before: 'original',
            after: 'draft',
            state: 'applied',
          },
        ],
      }),
    )
    tracker.dispose()
  })
})
