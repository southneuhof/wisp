# Wisp

Wisp is a plug-and-play CloudflareOS integration for your app. Connect your instance and give users access to their agents and conversations without building the chat experience from scratch.

The ready-made UI supports Vue and React. Both use the same visual design and connect through the framework-independent core. More UI frameworks are planned.

The default interface includes sign-in, workspace and conversation pickers, streaming responses, model selection, attachments, and a floating composer.

**Integrating with an agent?** Give it this repository or a package link and tell it to read the [agent integration guide](docs/agent-integration.md). The same guide ships as `INTEGRATION.md` in every npm package.

## Get started

### Vue

Install the ready-made interface:

```sh
npm install @southneuhof/wisp-vue-ui vue
```

Create a host component and mount it once in your app's root or authenticated layout:

```vue
<script setup lang="ts">
import { WispChat, useWispChat } from '@southneuhof/wisp-vue-ui'
import '@southneuhof/wisp-vue-ui/style.css'

const chat = useWispChat({
  url: 'https://os.example.com', // Your browser-accessible CloudflareOS URL
})
</script>

<template>
  <WispChat :chat="chat" />
</template>
```

### React

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

Mount the host once in a stable layout. In Next.js, keep it behind a client component boundary. React 18.3 or later is required. See the [React UI guide](packages/react-ui/README.md) for render props and reusable components.

Replace the URL with your instance. Wisp renders its own launcher and floating panel. Users sign in with their CloudflareOS accounts and choose a workspace and model.

Vue 3.5 or later is required. The package includes its styles, SVG icons, and UI dependencies. Import the stylesheet once. SSR apps should mount the host on the client; in Nuxt, use a `.client.vue` component.

Closing the panel keeps its draft and session. Unmounting the host disposes the client. Keep the host mounted when moving between routes if you want the chat to remain available.

## Choose a package

| Package                                           | Use it for                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`@southneuhof/wisp-vue-ui`](packages/vue-ui)     | The floating Vue chat or its reusable UI components                          |
| [`@southneuhof/wisp-vue`](packages/vue)           | A custom Vue interface with reactive state and automatic lifecycle cleanup   |
| [`@southneuhof/wisp-react-ui`](packages/react-ui) | The floating React chat or its reusable UI components                        |
| [`@southneuhof/wisp-react`](packages/react)       | A custom React interface with reactive state and automatic lifecycle cleanup |
| [`@southneuhof/wisp-core`](packages/core)         | A custom interface in another framework or vanilla JavaScript                |

Each package installs its SDK dependencies. The headless packages do not import the UI runtime or stylesheet. All packages ship ESM and TypeScript declarations.

## Change the theme

The default palette uses black accents, white surfaces, neutral grays, and red for danger actions. Pass the colors you want to change:

```vue
<WispChat
  :chat="chat"
  :theme="{
    accent: '#252525',
    primaryForeground: '#ffffff',
    menuBackground: '#ffffff',
    menuHover: 'rgb(0 0 0 / 6%)',
    fontFamily: 'Inter, system-ui, sans-serif',
  }"
/>
```

Colors accept CSS values, including variables from your app. The theme also applies to portaled menus. See [`WispChatTheme`](packages/vue-ui/src/theme.ts) for the full token list and the [Vue UI guide](packages/vue-ui/README.md) for slots, copy overrides, and reusable components.

## Use a custom interface

In Vue, call `useWispChat` from `@southneuhof/wisp-vue` inside a setup scope. It returns `client`, a read-only `state` ref, and the endpoint `url`. The composable starts the client on mount and disposes it with the scope.

In React, call `useWispChat` from `@southneuhof/wisp-react`. It returns `client`, a read-only snapshot in `state`, and `url`. It starts the client after mounting and disposes it after unmount, including React Strict Mode replay.

For other frameworks, import `createWispChat` from `@southneuhof/wisp-core`. Subscribe to snapshots, call `start()`, and call `dispose()` when the integration ends.

The client groups actions under `auth`, `workspaces`, `models`, `conversations`, and `attachments`. See the [typed API](packages/core/src/types.ts) and [examples](examples) for custom interfaces.

## Accounts and persistence

The CloudflareOS URL is public configuration. Credentials belong in the sign-in form; passwords are never persisted. For accounts linked to your app, pass the CloudflareOS session through the handoff below.

Workspace roles and resources determine access. A native `use` role cannot use chat. Models come from the selected workspace, so configure them in CloudflareOS.

## Use your app's linked account

If your backend already issues a CloudflareOS session for the signed-in user, pass it to Wisp:

```ts
await chat.client.auth.setSession({
  token: session.token,
  accountId: session.accountId,
})

// When the app signs out:
await chat.client.auth.setSession(null)
```

Supply a CloudflareOS token and the expected CloudflareOS account ID from your app's authenticated session flow. Wisp validates both with your configured instance before exposing the account or saving the session. An app cookie or unrelated JWT cannot authenticate CloudflareOS.

Call `setSession` when your app receives or replaces a session. It replaces the previous Wisp account and clears its workspace and conversation state. The default UI selects a workspace after authentication. A rejected session leaves Wisp signed out; surface the rejected promise in your app. Clearing the session also cancels any pending sign-in. Tokens stay out of public snapshots; validated sessions use the same per-tab persistence as password sign-in.

In the core package, call `client.auth.setSession(...)` directly. The Vue and React bindings expose the same client. Your backend owns account linking, token issuance, and upstream revocation; Wisp handles the browser connection. Clear Wisp's session as part of app logout, including when the app starts signed out.

## Compatibility

Wisp connects to CloudflareOS through its native Cap'n Web `/api` interface. Users can sign in with a password when enabled, or your app can supply a native CloudflareOS session. The browser must be able to reach the instance, and the instance must permit the app's origin. Cloudflare Access cross-origin sign-in and upstream resource-configuration screens are outside this package.

After an uncertain send or workspace-creation error, inspect native history before retrying. Wisp does not resend those mutations automatically. Cancelled uploads may leave bytes already accepted by the server.

## Work on Wisp

Use Node.js 24 and the pnpm version in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm release:prepare
```

The preparation command checks formatting and types, runs the tests, builds packages and examples, and verifies the tarballs in a clean consumer. Artifacts are written to `artifacts/`.

Run the default example against your instance:

```sh
VITE_CLOUDFLARE_OS_URL=http://127.0.0.1:8787 pnpm dev
```

See [architecture and verification](docs/implementation-status.md) and [publishing](docs/publishing.md). The [publishing prompt](docs/publish-prompt.md) is ready to hand to an agent for a release.

## License

[MIT](LICENSE). UI artifacts include license notices for their bundled dependencies.
