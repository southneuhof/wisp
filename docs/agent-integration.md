# Integrate Wisp into an application

Wisp adds CloudflareOS to an existing app. The ready-made UI supports Vue and React, with other UI frameworks planned. The core supports custom browser interfaces today.

Use this procedure when a user gives you the Wisp repository or an npm package link and asks to integrate CloudflareOS into an app. Repository: https://github.com/southneuhof/wisp.

## 1. Select the integration

Inspect the app's package manifest, lockfile, root layout, and rendering mode. Use its existing package manager.

| Requirement                             | Install                      |
| --------------------------------------- | ---------------------------- |
| Default floating UI in Vue 3.5+         | `@southneuhof/wisp-vue-ui`   |
| Custom UI in Vue 3.5+                   | `@southneuhof/wisp-vue`      |
| Default floating UI in React 18.3+      | `@southneuhof/wisp-react-ui` |
| Custom UI in React 18.3+                | `@southneuhof/wisp-react`    |
| Another framework or vanilla JavaScript | `@southneuhof/wisp-core`     |

Get the browser-accessible CloudflareOS URL from existing public configuration or the user. Sessions and selections automatically restore after refresh through per-tab `sessionStorage`.

Completion: integration package, public endpoint/config key, and rendering mode are identified.

## 2. Install the package

Install the selected package using the app's package manager. Vue bindings/UI require Vue 3.5+; React bindings/UI require React 18.3+ and the UI requires React DOM. Each UI package installs its matching core/binding dependencies and includes compiled CSS and icons. Vue uses assistant-ui Vue and Reka; React uses assistant-ui React and Base UI.

If the requested version is unavailable on npm, report the registry error. For an explicitly requested source integration, clone the repository, run `pnpm install --frozen-lockfile` and `pnpm release:prepare`, and install the matching core, framework binding, and UI tarballs from `artifacts/` into the app. Use portable vendored paths if those dependencies must travel with the app.

Completion: the lockfile resolves the selected package and its matching sibling versions.

## 3. Add the host

Choose the host for the app’s framework.

For the default Vue UI, create `WispHost.vue`:

```vue
<script setup lang="ts">
import { WispChat, useWispChat } from '@southneuhof/wisp-vue-ui'
import '@southneuhof/wisp-vue-ui/style.css'

const props = defineProps<{ url: string }>()
const chat = useWispChat({ url: props.url })
</script>

<template>
  <WispChat :chat="chat" />
</template>
```

Mount `<WispHost :url="cloudflareOsUrl" />` once beside the app's router outlet or in its authenticated layout. Resolve `cloudflareOsUrl` with that app's public configuration system. Keep the URL stable for the host's lifetime; remount the host when switching endpoints.

The component renders the launcher, floating panel, sign-in stage, pickers, and composer. Keep it mounted when closing its panel or navigating routes. Its internal close action preserves the draft; unmounting the owner disposes the client.

For SSR, put the host behind the framework's client-only boundary. In Nuxt, name it `WispHost.client.vue`.

For React, create a stable client component:

```tsx
'use client'
import { WispChat, useWispChat } from '@southneuhof/wisp-react-ui'
import '@southneuhof/wisp-react-ui/style.css'

export function WispHost({ url }: { url: string }) {
  const chat = useWispChat({ url })
  return <WispChat chat={chat} />
}
```

Use the app's public configuration for `url`. The hook owns startup and disposal and supports Strict Mode. Keep its host mounted across route changes; remount it with a new `key` when changing endpoints. In Next.js, keep the host in a client component; load it client-only if the app’s SSR setup requires browser-only dependencies.

Completion: one client-side host mounts, its launcher opens the packaged chat, and the stylesheet loads.

## 4. Wire the chosen branch

**Default UI:** pass the binding through `:chat`. The UI handles authentication, default workspace selection, conversation/model controls, and attachments. Customize through `theme`, `messages`, `errors`, and slots. Read the framework UI README before replacing slots/render props or composing its parts. React uses `header`, `controls`, `emptyState`, `message`, and `composerActions` render props.

**Headless Vue:** call `useWispChat` inside setup. Read `state.value` in script and invoke `client` actions. The composable owns startup/disposal; the application owns its forms and control flow.

**Headless React:** call `useWispChat` in a component. Read its `state` snapshot directly and invoke `client` actions. The hook owns startup/disposal.

**Core:** create one client with `createWispChat({ url })`, subscribe to snapshots, then call `start()`. Call the returned unsubscribe function and `dispose()` on teardown.

For a custom interface, narrow snapshots by `status` before reading account/workspace data. A workspace is chat-ready only when `workspace.status === 'ready'`. Select a workspace before a model/conversation. Model IDs come from `workspace.models`. Handle rejected operations in the UI.

The public action signatures are in `packages/core/src/types.ts` or the installed `dist/types.d.ts`. Use those declarations as the API authority. Login uses `client.auth.signIn({ username, password })`; sending uses `client.conversations.send({ text, files })`. Password values come from the user's form and remain transient.

Completion: the chosen UI branch uses the public SDK and has one lifecycle owner.

## 5. Match the app

Use `theme` for app colors/fonts. Defaults are usable without overrides. Theme values accept CSS colors and variables and are copied to portaled menus. All Wisp style names use the `wisp-` prefix.

Import packaged CSS once. Keep the installed package's UI primitives and compiled styles; host framework components, Tailwind plugins, icon fonts, and React aliases are unnecessary. Supply credentials through Wisp's login flow rather than application environment variables. For linked app accounts, use `client.auth.setSession({ token, accountId })` with the CloudflareOS token and expected CloudflareOS account ID obtained from the app's authenticated backend. Await and handle rejection; Wisp verifies identity with the configured instance. Apply new sessions on login/account change/token replacement. Call `client.auth.setSession(null)` on app logout and when the app starts signed out so a persisted Wisp session cannot outlive app login. Backend account linking and token issuance remain app responsibilities. App cookies and unrelated JWTs are not CloudflareOS sessions.

Completion: the chat fits the app's layout/theme and contains no shared credentials or duplicated SDK logic.

## 6. Verify the integration

Run the app's type check and production build. In a browser, open the launcher, sign in, switch workspaces and models, start/reopen a conversation, send a message, and close/reopen the panel. Refresh and verify restored account/workspace/thread selection. Verify sign-out clears local state. For linked accounts, also verify session handoff, account replacement, rejected tokens, and app logout. Exercise attachments if the app needs them.

If native credentials/resources or browser access are unavailable, report the blocked checks explicitly; passing builds are not proof of a native chat round trip. For a failed cross-origin connection, verify browser reachability and the server's origin/auth configuration before changing the SDK.

Completion: report the installed version, host/config file paths, public endpoint configuration key, and checks actually completed.
