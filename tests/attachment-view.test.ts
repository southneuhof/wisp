import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readonly, shallowRef } from 'vue'
import { createWispChat } from '@southneuhof/wisp-core'
import type { Attachment, ChatSnapshot } from '@southneuhof/wisp-core'
import AttachmentView from '../packages/vue-ui/src/AttachmentView.vue'

const createObjectURL = vi.fn(() => 'blob:download-test')
const revokeObjectURL = vi.fn()
const clickedAnchors: HTMLAnchorElement[] = []
const click = vi
  .spyOn(HTMLAnchorElement.prototype, 'click')
  .mockImplementation(function (this: HTMLAnchorElement) {
    clickedAnchors.push(this)
  })
const nativeURL = URL

function deferredBlob() {
  let resolve: (blob: Blob) => void = () => {}
  const promise = new Promise<Blob>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}

function fixture() {
  const client = createWispChat({ url: 'http://fixture.local' })
  const state = shallowRef<ChatSnapshot>({
    status: 'signed-out',
    connection: 'offline',
    error: null,
    passwordAuthEnabled: true,
  })
  const attachment: Attachment = {
    id: 'one',
    name: 'records.csv',
    mimeType: 'text/csv',
    size: 3,
    endpoint: 'http://fixture.local',
    accountId: 'alice',
    workspaceId: 'workspace',
    chatId: 1,
  }
  const download = vi.spyOn(client.attachments, 'download')
  const wrapper = mount(AttachmentView, {
    props: {
      attachment,
      chat: { client, state: readonly(state), url: 'http://fixture.local' },
      downloadLabel: 'Download',
    },
  })
  return { client, attachment, download, wrapper }
}

beforeEach(() => {
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  click.mockClear()
  clickedAnchors.length = 0
  vi.stubGlobal(
    'URL',
    class extends nativeURL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    },
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('attachment download lifecycle', () => {
  it('does not download after its component is unmounted', async () => {
    const f = fixture()
    const pending = deferredBlob()
    f.download.mockReturnValue(pending.promise)
    await f.wrapper.get('button').trigger('click')
    f.wrapper.unmount()
    pending.resolve(new Blob(['one']))
    await flushPromises()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
    f.client.dispose()
  })

  it('does not download a replaced attachment when its old request resolves', async () => {
    const f = fixture()
    const pending = deferredBlob()
    f.download.mockReturnValue(pending.promise)
    await f.wrapper.get('button').trigger('click')
    await f.wrapper.setProps({
      attachment: { ...f.attachment, id: 'two', name: 'replacement.csv' },
    })
    pending.resolve(new Blob(['one']))
    await flushPromises()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
    f.wrapper.unmount()
    f.client.dispose()
  })

  it('downloads the returned blob and releases its URL once on disposal', async () => {
    vi.useFakeTimers()
    const f = fixture()
    const blob = new Blob(['one'])
    f.download.mockResolvedValue(blob)
    await f.wrapper.get('button').trigger('click')
    await flushPromises()
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledOnce()
    expect(clickedAnchors[0]?.download).toBe('records.csv')
    f.wrapper.unmount()
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      'blob:download-test',
    )
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledOnce()
    f.client.dispose()
  })

  it('describes a download failure with its attachment name', async () => {
    const f = fixture()
    await f.wrapper.setProps({ failedLabel: 'Gagal' })
    f.download.mockRejectedValue(new Error('offline'))
    await f.wrapper.get('button').trigger('click')
    await flushPromises()
    expect(f.wrapper.get('[role="status"]').text()).toBe('Gagal: records.csv')
    f.wrapper.unmount()
    f.client.dispose()
  })
})
