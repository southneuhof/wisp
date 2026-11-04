# @southneuhof/wisp-core

Agents integrating this package: read the [integration guide](https://github.com/southneuhof/wisp/blob/main/docs/agent-integration.md), also included as `INTEGRATION.md` in this package.

The framework-independent core of Wisp, a plug-and-play CloudflareOS integration for your app. Use it to build a custom interface in any browser framework or vanilla JavaScript. It handles native authentication, workspace selection, conversations, streaming responses, history, attachments, and connection recovery.

```sh
npm install @southneuhof/wisp-core
```

```ts
import { createWispChat } from '@southneuhof/wisp-core'

const chat = createWispChat({ url: 'https://os.example.com' })
const unsubscribe = chat.subscribe((snapshot) => console.log(snapshot.status))
await chat.start()
// Use chat.auth, chat.workspaces, chat.models, chat.conversations, and chat.attachments.
// On application teardown:
unsubscribe()
chat.dispose()
```

For an app-linked CloudflareOS account, call `await chat.auth.setSession({ token, accountId })`. Wisp validates the token and expected account ID with CloudflareOS before accepting or persisting the session. Call `await chat.auth.setSession(null)` on app logout. Replacement clears the previous account's workspace and conversation state. See the [session handoff guide](https://github.com/southneuhof/wisp#use-your-apps-linked-account) for the host lifecycle contract.

Users can also sign into their own native accounts. Sessions and selections automatically restore after a refresh using per-tab `sessionStorage`. Passwords are never persisted. The package imports no Vue, CSS, or UI runtime.

See the [repository documentation](https://github.com/southneuhof/wisp#readme) for configuration and current compatibility limits. MIT licensed.
