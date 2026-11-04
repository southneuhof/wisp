# @southneuhof/wisp-react-ui

Add CloudflareOS to your React app with Wisp’s ready-made chat interface. The React and Vue interfaces share Wisp’s visual stylesheet: the floating panel, blurred backdrop, pickers, composer, and transitions have the same design.

```sh
npm install @southneuhof/wisp-react-ui react react-dom
```

```tsx
'use client'
import { WispChat, useWispChat } from '@southneuhof/wisp-react-ui'
import '@southneuhof/wisp-react-ui/style.css'

export function WispHost() {
  const chat = useWispChat({ url: 'https://os.example.com' })
  return <WispChat chat={chat} />
}
```

Mount the host once in a stable layout and import CSS once. React 18.3+ and React DOM are peer dependencies. The package installs its Wisp bindings, assistant-ui, Base UI, and markdown dependencies. It needs no Vue, Reka UI, host component library, Tailwind configuration, or icon font. Next.js hosts use a client component boundary.

Closing the panel preserves its draft and session. Unmounting the host disposes the client. Sessions restore automatically after refresh. For linked accounts, pass the app-issued CloudflareOS session to `chat.client.auth.setSession({ token, accountId })`; call `setSession(null)` on app logout.

## Customize

Pass a partial `WispChatTheme` through `theme`. The tokens match the Vue interface and accept CSS colors and variables. Defaults use black accents and white surfaces. Portaled menus receive the same tokens. Motion respects `prefers-reduced-motion`.

`messages` overrides copy, and `errors` maps SDK error codes to display text. Render props replace Vue slots:

| Prop              | Receives                                                            | Purpose                         |
| ----------------- | ------------------------------------------------------------------- | ------------------------------- |
| `header`          | Account, workspaces, workspace state, snapshot, busy state, actions | Replace the default header      |
| `controls`        | The same context                                                    | Add custom controls             |
| `emptyState`      | React node                                                          | Show an empty conversation view |
| `message`         | Render function within assistant-ui context                         | Replace message rendering       |
| `composerActions` | Chat binding                                                        | Add composer controls           |

`title` labels the launcher. Read the exported `WispChatProps`, `WispChatTheme`, and `WispChatActions` types for the full contract.

## Reusable parts

Exports include `ChatConversationPicker`, `ChatModelPicker`, `ChatOptionsMenu`, `ChatSignIn`, `ChatIconButton`, `ChatIcon`, `ChatSpinner`, `ChatAttachment`, and `useChatTheme`. Menus compose Base UI primitives directly. `ChatMessage`, `ChatMarkdown`, and `ChatAttachmentPreview` consume assistant-ui context and require its runtime/message/attachment providers.

Agents: read the [integration guide](https://github.com/southneuhof/wisp/blob/main/docs/agent-integration.md), also included as `INTEGRATION.md` in the package. MIT licensed.
