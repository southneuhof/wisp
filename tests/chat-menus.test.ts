import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readonly, shallowRef } from 'vue'
import { createWispChat } from '@southneuhof/wisp-core'
import type { ChatSnapshot } from '@southneuhof/wisp-core'
import WispChat from '../packages/vue-ui/src/WispChat.vue'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn())
  document.body.replaceChildren()
})
async function setup() {
  const client = createWispChat({ url: 'http://os.example' })
  const selectModel = vi
    .spyOn(client.models, 'select')
    .mockImplementation(() => {})
  const startNew = vi
    .spyOn(client.conversations, 'startNew')
    .mockImplementation(() => {})
  const signOut = vi.spyOn(client.auth, 'signOut').mockImplementation(() => {})
  vi.spyOn(client.conversations, 'list').mockResolvedValue([])
  const state = shallowRef<ChatSnapshot>({
    status: 'authenticated',
    connection: 'connected',
    error: null,
    account: { id: 'alice', name: 'Alice' },
    workspaces: [{ id: 'a', title: 'Workspace A', role: 'build' }],
    workspace: {
      status: 'ready',
      workspace: { id: 'a', title: 'Workspace A', role: 'build' },
      models: [
        { id: 'one', name: 'Model One' },
        { id: 'two', name: 'Model Two' },
      ],
      modelId: 'one',
      conversations: [{ id: 1, title: 'Earlier chat', running: false }],
      conversation: { status: 'draft', messages: [] },
      running: false,
      uploading: false,
      hasEarlier: false,
      loadingEarlier: false,
    },
  })
  const wrapper = mount(WispChat, {
    attachTo: document.body,
    props: {
      chat: { client, state: readonly(state), url: 'http://os.example' },
      theme: { accent: '#123456', menuBackground: '#abcdef' },
    },
  })
  cleanup.push(() => {
    wrapper.unmount()
    client.dispose()
  })
  await wrapper.get('button[aria-label="Open chat"]').trigger('click')
  await flushPromises()
  return { wrapper, selectModel, startNew, signOut, state }
}
async function openMenu(
  wrapper: Awaited<ReturnType<typeof setup>>['wrapper'],
  label: string,
) {
  await wrapper
    .get(`button[aria-label="${label}"]`)
    .trigger('click', { button: 0, ctrlKey: false })
  await flushPromises()
}
function item(text: string) {
  const node = [
    ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ].find((el) => el.textContent?.trim() === text)
  if (!node) throw new Error(`Missing menu item: ${text}`)
  return node
}
async function clickItem(node: HTMLElement) {
  node.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
  )
  node.click()
  await flushPromises()
}
describe('standalone floating menus', () => {
  it('does not show the empty-workspace prompt during a switch', async () => {
    const f = await setup()
    const current = f.state.value
    if (current.status !== 'authenticated') throw new Error('Expected account')
    f.state.value = { ...current, workspace: { status: 'opening', id: 'a' } }
    await flushPromises()
    expect(f.wrapper.text()).not.toContain(
      'Select a workspace from Chat settings',
    )
    expect(f.wrapper.find('[role="status"]').exists()).toBe(true)
  })
  it('changes models from a portaled menu without closing the chat and carries its theme', async () => {
    const f = await setup()
    await openMenu(f.wrapper, 'Model')
    const menu = document.querySelector<HTMLElement>('.wisp-menu-content')
    expect(menu?.style.getPropertyValue('--wisp-menu-bg')).toBe('#abcdef')
    await clickItem(item('Model Two'))
    expect(f.selectModel).toHaveBeenCalledWith('two')
    expect(f.wrapper.get('.wisp-floating').attributes('aria-hidden')).toBe(
      'false',
    )
  })
  it('starts a conversation without dismissing the floating panel', async () => {
    const f = await setup()
    await openMenu(f.wrapper, 'Select conversation')
    expect(
      document.querySelector('.wisp-menu-content')?.textContent,
    ).not.toContain('Conversations')
    await clickItem(item('New conversation'))
    expect(f.startNew).toHaveBeenCalledOnce()
    expect(f.wrapper.get('.wisp-floating').attributes('aria-hidden')).toBe(
      'false',
    )
  })
  it('opens workspace creation in the side submenu and signs out with the header icon', async () => {
    const f = await setup()
    await openMenu(f.wrapper, 'Chat settings')
    await clickItem(item('Workspace A'))
    await clickItem(item('Create workspace'))
    expect(
      document.querySelector('input[aria-label="Workspace name"]'),
    ).not.toBeNull()
    expect(f.wrapper.get('.wisp-floating').attributes('aria-hidden')).toBe(
      'false',
    )
    document
      .querySelector<HTMLButtonElement>('button[aria-label="Sign out"]')
      ?.click()
    await flushPromises()
    expect(f.signOut).toHaveBeenCalledOnce()
  })
})
