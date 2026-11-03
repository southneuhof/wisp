# Wisp

Browser SDK and optional Vue components for native CloudflareOS accounts. The browser connects directly to the configured CloudflareOS instance. No backend helper or database is required.

## Packages

- `@southneuhof/wisp-core` owns authentication, workspace lifecycle, conversation state, streaming, history, file validation/uploads/downloads, cancellation, and recovery.
- `@southneuhof/wisp-vue` adapts the client to a read-only Vue shallow ref and disposes it when its Vue scope ends.
- `@southneuhof/wisp-vue-ui` provides the optional styled interface. It has no Tailwind or application-component requirements.

## Installation

The initial npm release is being prepared. After publication, install the package for your interface:

```sh
# Default floating Vue component (includes core and headless bindings)
npm install @southneuhof/wisp-vue-ui vue

# Custom Vue interface
npm install @southneuhof/wisp-vue vue

# Framework-independent SDK
npm install @southneuhof/wisp-core
```

Wisp ships ESM and TypeScript declarations. Vue consumers require Vue 3.5 or later. The default UI includes its compiled CSS and SVG icons; no application-specific components, Tailwind configuration, or React aliases are required.

To test unpublished builds, run `pnpm release:prepare` and install all three current tarballs from `artifacts/` together.

## Use the Vue interface

```vue
<script setup lang="ts">
import { WispChat, useWispChat } from '@southneuhof/wisp-vue-ui'
import '@southneuhof/wisp-vue-ui/style.css'
const chat = useWispChat({ url: 'https://os.example.com' })
</script>
<template><WispChat :chat="chat" /></template>
```

Users sign into their own CloudflareOS accounts and choose or create workspaces. Native workspace roles and resource capabilities determine access. Shared workspaces follow CloudflareOS's shared visibility behavior.

Mount the composable in a stable parent when toggling a floating panel. The default component is a self-contained floating chat with a launcher and animated blurred backdrop. It does not own or dispose the caller's client. Use `messages`, `errors`, `title`, the `WispChatTheme` color token prop, and the `header`, `empty-state`, `message`, and `composer-actions` slots to customize presentation.

## Use custom interfaces

Import `useWispChat` from `@southneuhof/wisp-vue` for a custom Vue interface. Its `state` is a read-only shallow ref; its `client` exposes the same SDK actions as core. Import `createWispChat` from `@southneuhof/wisp-core` for other frameworks. Subscribe to immutable snapshots and call `start()`. Call `dispose()` when the integration ends.

Actions are grouped under `auth`, `workspaces`, `models`, `conversations`, and `attachments`. `workspaces.create({title})` creates and selects a workspace. `conversations.startNew()` opens a local draft. `conversations.send({text,files})` validates and uploads files before sending. `attachments.download(ref)` returns a Blob without opening a browser download dialog.

## Sessions and lifecycle

Sessions remain in memory by default. Set `sessionPersistence: 'session'` to store the native token and validated selections in per-tab sessionStorage. Passwords are never persisted. Session tokens are deliberately available to the browser runtime, but are excluded from public snapshots and logs.

`auth.signOut()` clears local state/storage and closes RPC capabilities. It permits another login. It does not revoke the upstream account token or automatically stop remote agents. `dispose()` is terminal and idempotent. It releases resources while preserving explicitly enabled per-tab persistence for a later mount. Cancelled uploads may already have stored bytes upstream, but cannot subsequently dispatch a message. Stop remains pending until native idle is confirmed.

The SDK fences late responses when account, workspace, or conversation selection changes. It never automatically resends a message or creates another workspace after an uncertain mutation outcome. Check native history before retrying.

## Compatibility

Initial support targets password-enabled CloudflareOS using the native Cap'n Web `/api` interface. The protocol subset was traced against local upstream revision `b51ff924c5ba61a9aa13cf0fd15333550f9021b5`. Cloudflare Access deployments can reject cross-origin connections and password login. Such sign-in providers and resource-configuration UIs are not implemented here.

New workspaces can be provisional and absent from native lists until activity. The SDK retains returned workspace metadata rather than recreating them. Some shared workspaces require upstream resource configuration. A native `use` role cannot use chat. Models are discovered in the opened workspace; no universal model ID is assumed.

## Development

Use Node.js 22 or later and pnpm.

```sh
pnpm install
pnpm build
pnpm test
pnpm type-check
pnpm build:examples
pnpm verify:packages
```

Run the ready-made example with a public endpoint:

```sh
VITE_CLOUDFLARE_OS_URL=http://127.0.0.1:8787 pnpm dev
```

Run another example with `pnpm exec vite examples/vanilla` or `pnpm exec vite examples/vue-custom`. Do not put a shared service-account password in browser environment variables.

See [architecture and verification](docs/implementation-status.md) for package boundaries and validation limits, and [publishing](docs/publishing.md) for the release process.

Wisp uses the `@southneuhof` package scope, `WispChat`/`useWispChat` Vue entry points, and `createWispChat` for the framework-independent client. CSS classes and theme variables use the `wisp-` prefix. Existing `os-chat:` browser storage keys are intentionally retained so renaming the library does not discard saved sessions or model preferences.

## License

MIT. See [LICENSE](LICENSE). Bundled third-party notices are included in the Vue UI artifact.
