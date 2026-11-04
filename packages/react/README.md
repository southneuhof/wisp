# @southneuhof/wisp-react

React bindings for Wisp, a plug-and-play CloudflareOS integration for your app. Use this package for a custom interface; use `@southneuhof/wisp-react-ui` for the ready-made chat.

```tsx
import { useWispChat } from '@southneuhof/wisp-react'

export function ConnectionStatus() {
  const chat = useWispChat({ url: 'https://os.example.com' })
  return <p>{chat.state.status}</p>
}
```

The hook returns `client`, an immutable `state` snapshot, and `url`. It subscribes with `useSyncExternalStore`, starts the core client after mounting, and disposes it on unmount. Strict Mode effect replay keeps the client alive. Keep the host stable; remount it when changing endpoints. React 18.3+ is required.

Sessions restore automatically after refresh. For linked app accounts, use `client.auth.setSession({ token, accountId })` and clear it with `client.auth.setSession(null)` on app logout. The core validates the session with CloudflareOS.

Agents: read the [integration guide](https://github.com/southneuhof/wisp/blob/main/docs/agent-integration.md), also included as `INTEGRATION.md` in the package. MIT licensed.
