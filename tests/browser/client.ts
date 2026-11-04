import type { ChatSnapshot, WispChatClient } from '@southneuhof/wisp-core'
export function createFixture(signedOut = false) {
  const workspaces = [
    { id: 'a', title: 'Workspace A', role: 'build' as const },
    { id: 'b', title: 'Workspace B', role: 'build' as const },
  ]
  if (new URLSearchParams(location.search).has('many'))
    for (let i = 0; i < 60; i++)
      workspaces.push({
        id: `extra-${i}`,
        title: `Workspace ${i + 3}`,
        role: 'build',
      })
  const models = [
    { id: 'one', name: 'Model One' },
    { id: 'two', name: 'Model Two' },
  ]
  let state: ChatSnapshot = signedOut
    ? {
        status: 'signed-out',
        connection: 'connected',
        error: null,
        passwordAuthEnabled: true,
      }
    : {
        status: 'authenticated',
        connection: 'connected',
        error: null,
        account: { id: 'alice', name: 'Alice' },
        workspaces,
        workspace: {
          status: 'ready',
          workspace: workspaces[0]!,
          models,
          modelId: 'one',
          conversations: [
            { id: 1, title: 'Traffic overview', running: false },
            ...(new URLSearchParams(location.search).has('many')
              ? Array.from({ length: 60 }, (_, i) => ({
                  id: i + 2,
                  title: `Conversation ${i + 2}`,
                  running: false,
                }))
              : []),
          ],
          conversation: {
            status: 'conversation',
            id: 1,
            messages: [
              {
                id: 'u',
                role: 'user',
                text: 'Show me the traffic summary.',
                status: 'complete',
                attachments: [],
              },
              {
                id: 'a',
                role: 'assistant',
                text: '## Traffic summary\n\nTraffic is flowing normally across all monitored routes.\n\n- **Volume:** 12,480 vehicles\n- **Average speed:** 72 km/h\n\nNo incidents reported.',
                status: 'complete',
                attachments: [],
              },
            ],
          },
          running: false,
          uploading: false,
          loadingEarlier: false,
          hasEarlier: false,
        },
      }
  const listeners = new Set<(s: ChatSnapshot) => void>()
  const emit = () => listeners.forEach((l) => l(state))
  const client: WispChatClient = {
    start: async () => {},
    getSnapshot: () => state,
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    dispose() {
      listeners.clear()
    },
    auth: {
      async signIn() {},
      async setSession() {},
      signOut() {
        state = {
          status: 'signed-out',
          connection: 'connected',
          error: null,
          passwordAuthEnabled: true,
        }
        emit()
      },
    },
    workspaces: {
      list: async () => workspaces,
      create: async () => workspaces[0]!,
      async select(id) {
        if (
          state.status === 'authenticated' &&
          state.workspace.status === 'ready'
        ) {
          state = {
            ...state,
            workspace: {
              ...state.workspace,
              workspace: workspaces.find((w) => w.id === id)!,
            },
          }
          emit()
        }
      },
    },
    models: {
      select(id) {
        if (
          state.status === 'authenticated' &&
          state.workspace.status === 'ready'
        ) {
          state = { ...state, workspace: { ...state.workspace, modelId: id } }
          emit()
        }
      },
    },
    conversations: {
      list: async () => [],
      async select() {},
      startNew() {
        if (
          state.status === 'authenticated' &&
          state.workspace.status === 'ready'
        ) {
          state = {
            ...state,
            workspace: {
              ...state.workspace,
              conversation: { status: 'draft', messages: [] },
            },
          }
          emit()
        }
      },
      async send() {},
      async stop() {},
      async loadEarlier() {},
    },
    attachments: { download: async () => new Blob() },
  }
  return client
}
