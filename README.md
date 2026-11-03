# Wisp

Wisp adds a floating chat to Vue apps and connects it to your CloudflareOS instance. It includes sign-in, workspace and conversation pickers, streaming responses, model selection, attachments, and a composer with blur and zoom transitions.

**Integrating with an agent?** Give it this repository or a package link and tell it to read the [agent integration guide](docs/agent-integration.md). The same guide ships as `INTEGRATION.md` in every npm package.

## Add it to a Vue app

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
  sessionPersistence: 'session', // Optional: restore login after a refresh
})
</script>

<template>
  <WispChat :chat="chat" />
</template>
```

Replace the URL with your instance. Wisp renders its own launcher and floating panel. Users sign in with their CloudflareOS accounts and choose a workspace and model.

Vue 3.5 or later is required. The package includes its styles, SVG icons, and UI dependencies. Import the stylesheet once. SSR apps should mount the host on the client; in Nuxt, use a `.client.vue` component.

Closing the panel keeps its draft and session. Unmounting the host disposes the client. Keep the host mounted when moving between routes if you want the chat to remain available.

## Choose a package

| Package                                       | Use it for                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| [`@southneuhof/wisp-vue-ui`](packages/vue-ui) | The floating Vue chat or its reusable UI components                        |
| [`@southneuhof/wisp-vue`](packages/vue)       | A custom Vue interface with reactive state and automatic lifecycle cleanup |
| [`@southneuhof/wisp-core`](packages/core)     | A custom interface in another framework or vanilla JavaScript              |

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

Outside Vue, import `createWispChat` from `@southneuhof/wisp-core`. Subscribe to snapshots, call `start()`, and call `dispose()` when the integration ends.

The client groups actions under `auth`, `workspaces`, `models`, `conversations`, and `attachments`. See the [typed API](packages/core/src/types.ts) and [examples](examples) for custom interfaces.

## Accounts and persistence

The CloudflareOS URL is public configuration. Credentials belong in the sign-in form; passwords are never persisted. Your app's login and CloudflareOS login are separate unless you implement an explicit account integration.

Sessions stay in memory by default. `sessionPersistence: 'session'` stores the native token and validated selections in per-tab `sessionStorage`. Treat the token as a browser credential. Sign-out clears local state and storage; it does not revoke the upstream token or stop remote agents automatically.

Workspace roles and resources determine access. A native `use` role cannot use chat. Models come from the selected workspace, so configure them in CloudflareOS.

## Compatibility

Wisp currently supports password-enabled CloudflareOS through its native Cap'n Web `/api` interface. The browser must be able to reach the instance, and the instance must permit the app's origin. Cloudflare Access cross-origin sign-in and upstream resource-configuration screens are outside this package.

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

[MIT](LICENSE). The Vue UI artifact includes license notices for its bundled dependencies.
