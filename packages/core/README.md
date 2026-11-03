# @southneuhof/wisp-core

Wisp's framework-independent browser SDK for CloudflareOS. It handles native authentication, workspace selection, conversations, streaming responses, history, attachments, and connection recovery.

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

Users sign into their own native accounts. Sessions stay in memory by default; set `sessionPersistence: 'session'` for per-tab restoration. Passwords are never persisted. The package imports no Vue, CSS, or UI runtime.

See the [repository documentation](https://github.com/southneuhof/wisp#readme) for configuration and current compatibility limits. MIT licensed.
