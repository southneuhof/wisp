import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readonly, shallowRef } from 'vue'
import { createWispChat } from '@southneuhof/wisp-core'
import type { ChatSnapshot } from '@southneuhof/wisp-core'
import WispChat from '../packages/vue-ui/src/WispChat.vue'

async function setup(
  options: { running?: boolean; modelId?: string | null } = {},
) {
  const client = createWispChat({ url: 'http://os.example' })
  const state = shallowRef<ChatSnapshot>({
    status: 'authenticated',
    connection: 'connected',
    error: null,
    account: { id: 'alice', name: 'Alice' },
    workspaces: [{ id: 'a', title: 'A', role: 'build' }],
    workspace: {
      status: 'ready',
      workspace: { id: 'a', title: 'A', role: 'build' },
      models: options.modelId === null ? [] : [{ id: 'model', name: 'Model' }],
      modelId: options.modelId === undefined ? 'model' : options.modelId,
      conversations: [],
      conversation: { status: 'draft', messages: [] },
      running: options.running ?? false,
      uploading: false,
      loadingEarlier: false,
      hasEarlier: false,
    },
  })
  const send = vi.spyOn(client.conversations, 'send').mockResolvedValue()
  const wrapper = mount(WispChat, {
    props: {
      chat: { client, state: readonly(state), url: 'http://os.example' },
    },
  })
  await wrapper.get('button[aria-label="Open chat"]').trigger('click')
  await flushPromises()
  if (!options.running && options.modelId !== null)
    await vi.waitFor(() =>
      expect(
        wrapper
          .get('button[aria-label="Add attachment"]')
          .attributes('disabled'),
      ).toBeUndefined(),
    )
  function drop(file: File) {
    const event = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file], types: ['Files'] },
    })
    wrapper.get('.wisp-composer').element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  }
  function dispose() {
    wrapper.unmount()
    client.dispose()
  }
  return { wrapper, send, drop, dispose }
}

describe('composer file drops', () => {
  it('stages dropped files locally and sends the original File without text', async () => {
    const f = await setup()
    const picked = new File(['picked'], 'picked.txt', { type: 'text/plain' })
    const dropped = new File(['dropped'], 'dropped.txt', { type: 'text/plain' })
    f.drop(picked)
    await flushPromises()
    expect(f.wrapper.text()).toContain('picked.txt')
    f.drop(dropped)
    await flushPromises()
    expect(f.send).not.toHaveBeenCalled()
    expect(f.wrapper.text()).toContain('dropped.txt')
    await f.wrapper.get('button[aria-label="Send message"]').trigger('click')
    expect(f.send).toHaveBeenCalledOnce()
    expect(f.send.mock.calls[0]?.[0].files?.[0]).toBe(picked)
    expect(f.send.mock.calls[0]?.[0].files?.[1]).toBe(dropped)
    expect(f.send.mock.calls[0]?.[0].text).toBe('')
    f.dispose()
  })

  it.each([{ running: true }, { modelId: null }])(
    'ignores a drop when unavailable: %j',
    async (options) => {
      const f = await setup(options)
      f.drop(new File(['ignored'], 'ignored.txt'))
      await flushPromises()
      expect(f.wrapper.text()).not.toContain('ignored.txt')
      expect(f.send).not.toHaveBeenCalled()
      f.dispose()
    },
  )

  it('ignores a drop while sending and prevents browser navigation', async () => {
    const f = await setup()
    let finish: (() => void) | undefined
    f.send.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    await f.wrapper.get('textarea').setValue('hello')
    await f.wrapper.get('button[aria-label="Send message"]').trigger('click')
    f.drop(new File(['ignored'], 'ignored.txt'))
    await flushPromises()
    expect(f.wrapper.text()).not.toContain('ignored.txt')
    expect(f.send).toHaveBeenCalledOnce()
    finish?.()
    await flushPromises()
    expect(
      f.wrapper.get('button[aria-label="Send message"]').attributes(),
    ).toHaveProperty('disabled')
    f.dispose()
  })
})
