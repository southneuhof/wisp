import type {
  ChatActivity,
  ChatDraftChanges,
  ChatSnapshot,
  ConversationView,
  WispChatClient,
} from '@southneuhof/wisp-core'

const approval: ChatActivity = {
  id: 'approval',
  kind: 'request',
  sequence: 2,
  title: 'Create the issue',
  fields: [{ label: 'Title', value: 'Review the launch checklist' }],
  state: 'pending',
  request: { kind: 'action', id: 8 },
}

const draftChanges: ChatDraftChanges = {
  pending: true,
  ready: true,
  files: [
    {
      workpieceId: 1,
      path: 'README.md',
      before: 'Quick start\nInstall dependencies.\n',
      after: 'Quick start\nRun pnpm install, then pnpm dev.\n',
      state: 'applied',
    },
  ],
}

export function createFixture(signedOut = false) {
  const activityEnabled = new URLSearchParams(location.search).has('activity')
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
                sequence: 1,
              },
              {
                id: 'a',
                role: 'assistant',
                text: '## Traffic summary\n\nTraffic is flowing normally across all monitored routes.\n\n- **Volume:** 12,480 vehicles\n- **Average speed:** 72 km/h\n\nNo incidents reported.',
                status: 'complete',
                attachments: activityEnabled
                  ? [
                      {
                        id: 'brief',
                        name: 'Launch brief.md',
                        mimeType: 'text/markdown',
                        size: 13,
                        endpoint: 'http://os.example',
                        accountId: 'alice',
                        workspaceId: 'a',
                        chatId: 1,
                      },
                    ]
                  : [],
                sequence: 3,
              },
            ],
            ...(activityEnabled
              ? {
                  activity: [
                    {
                      id: 'reasoning',
                      kind: 'reasoning',
                      sequence: 2,
                      text: 'I will read the current notes first.',
                    },
                    {
                      id: 'tool',
                      kind: 'tool',
                      sequence: 2,
                      title: 'Find the checklist',
                      state: 'complete',
                      detail: 'Found the launch checklist in the Product team.',
                    },
                    approval,
                  ] satisfies ChatActivity[],
                  draftChanges,
                }
              : {}),
          },
          running: false,
          uploading: false,
          loadingEarlier: false,
          hasEarlier: false,
        },
      }
  const listeners = new Set<(s: ChatSnapshot) => void>()
  const emit = () => listeners.forEach((l) => l(state))
  function updateConversation(
    update: (
      conversation: Extract<ConversationView, { id: number }>,
    ) => ConversationView,
  ) {
    if (state.status !== 'authenticated' || state.workspace.status !== 'ready')
      return
    const { workspace } = state
    if (workspace.conversation.status === 'draft') return
    state = {
      ...state,
      workspace: { ...workspace, conversation: update(workspace.conversation) },
    }
    emit()
  }
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
    attachments: {
      download: async () =>
        new Blob(['# Launch brief'], { type: 'text/markdown' }),
    },
    activity: {
      async decide(id, decision) {
        updateConversation((conversation) => ({
          ...conversation,
          activity: conversation.activity?.map((entry) =>
            entry.kind === 'request' && entry.id === id
              ? ({
                  ...entry,
                  state: decision === 'approve' ? 'approved' : 'rejected',
                } satisfies ChatActivity)
              : entry,
          ),
        }))
      },
      async reviewChanges() {
        updateConversation((conversation) => ({
          ...conversation,
          draftChanges: undefined,
        }))
      },
    },
  }
  return client
}
