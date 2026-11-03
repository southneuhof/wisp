import { describe, it, expect, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, readonly, shallowRef } from 'vue'
import { createWispChat } from '@southneuhof/wisp-core'
import type { ChatSnapshot } from '@southneuhof/wisp-core'
import { useWispChat } from '@southneuhof/wisp-vue'
import WispChat from '../packages/vue-ui/src/WispChat.vue'
import { renderSafeMarkdown } from '../packages/vue-ui/src/markdown.js'
function binding() {
  const client = createWispChat({ url: 'http://os.example' })
  const state = shallowRef<ChatSnapshot>({
    status: 'signed-out',
    connection: 'connected',
    error: null,
    passwordAuthEnabled: true,
  })
  return {
    client,
    state,
    chat: { client, state: readonly(state), url: 'http://os.example' },
  }
}
describe('Vue presentation and lifecycle', () => {
  it('submits user credentials and clears the password input immediately', async () => {
    const f = binding()
    const signIn = vi.spyOn(f.client.auth, 'signIn').mockResolvedValue()
    const wrapper = mount(WispChat, { props: { chat: f.chat } })
    await wrapper.get('button[aria-label="Open chat"]').trigger('click')
    await wrapper.get('input[name="username"]').setValue('alice')
    await wrapper.get('input[name="password"]').setValue('private')
    await wrapper.get('form').trigger('submit')
    expect(signIn).toHaveBeenCalledWith({
      username: 'alice',
      password: 'private',
    })
    expect(
      wrapper.get<HTMLInputElement>('input[name="password"]').element.value,
    ).toBe('')
    wrapper.unmount()
    f.client.dispose()
  })
  it('supports dictionary overrides and custom header content without a provider', async () => {
    const f = binding()
    const wrapper = mount(WispChat, {
      props: { chat: f.chat, messages: { signIn: 'Masuk' } },
      slots: { header: () => h('span', 'My app') },
    })
    await wrapper.get('button[aria-label="Open chat"]').trigger('click')
    expect(wrapper.text()).toContain('My app')
    expect(wrapper.text()).toContain('Masuk')
    wrapper.unmount()
    f.client.dispose()
  })
  it('lets a custom header own conversation controls and suppresses default toolbars', async () => {
    const f = binding()
    f.state.value = {
      status: 'authenticated',
      connection: 'connected',
      error: null,
      account: { id: 'alice', name: 'Alice' },
      workspaces: [],
      workspace: { status: 'none' },
    }
    const wrapper = mount(WispChat, {
      props: { chat: f.chat },
      slots: {
        header: () => h('div', 'Reference title and picker'),
        controls: () => h('div', 'Popover-owned settings'),
      },
    })
    await wrapper.get('button[aria-label="Open chat"]').trigger('click')
    expect(wrapper.text()).toContain('Reference title and picker')
    expect(wrapper.text()).toContain('Popover-owned settings')
    expect(wrapper.find('.wisp-toolbar').exists()).toBe(false)
    wrapper.unmount()
    f.client.dispose()
  })
  it('renders native workspace and empty model states', async () => {
    const f = binding()
    f.state.value = {
      status: 'authenticated',
      connection: 'connected',
      error: null,
      account: { id: 'alice', name: 'Alice' },
      workspaces: [{ id: 'a', title: 'A', role: 'build' }],
      workspace: {
        status: 'ready',
        workspace: { id: 'a', title: 'A', role: 'build' },
        models: [],
        modelId: null,
        conversations: [],
        conversation: { status: 'draft', messages: [] },
        running: false,
        uploading: false,
        hasEarlier: false,
        loadingEarlier: false,
      },
    }
    const wrapper = mount(WispChat, { props: { chat: f.chat } })
    await wrapper.get('button[aria-label="Open chat"]').trigger('click')
    expect(wrapper.text()).toContain('No chat model is available')
    expect(
      wrapper.get('button[aria-label="Send message"]').attributes(),
    ).toHaveProperty('disabled')
    wrapper.unmount()
    f.client.dispose()
  })
  it('starts exactly one owned client and disposes it with its Vue scope', () => {
    let start: MockInstance<() => Promise<void>> | undefined
    let dispose: MockInstance<() => void> | undefined
    const component = defineComponent({
      setup() {
        const chat = useWispChat({ url: 'http://os.example' })
        start = vi.spyOn(chat.client, 'start').mockResolvedValue()
        dispose = vi.spyOn(chat.client, 'dispose')
        return () => h('div', chat.state.value.status)
      },
    })
    const wrapper = mount(component)
    expect(start).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(dispose).toHaveBeenCalledTimes(1)
  })
  it('removes unsafe HTML and link protocols while keeping tables readable', () => {
    const html = renderSafeMarkdown(
      '<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n|a|b|\n|-|-|\n|1|2|',
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('wisp-markdown-scroll')
    expect(html).toContain('<table>')
  })
})
