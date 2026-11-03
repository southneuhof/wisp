# Integrate Wisp into an application

Use this procedure when a user gives you the Wisp repository or an npm package link and asks to add chat to an app. Repository: https://github.com/southneuhof/wisp.

## 1. Select the integration

Inspect the app's package manifest, lockfile, root layout, and rendering mode. Use its existing package manager.

| Requirement                             | Install                    |
| --------------------------------------- | -------------------------- |
| Default floating UI in Vue 3.5+         | `@southneuhof/wisp-vue-ui` |
| Custom UI in Vue 3.5+                   | `@southneuhof/wisp-vue`    |
| Another framework or vanilla JavaScript | `@southneuhof/wisp-core`   |

Get the browser-accessible CloudflareOS URL from existing public configuration or the user. Choose memory-only persistence unless the user asks to restore login across refreshes; then use `sessionPersistence: 'session'`.

Completion: integration package, public endpoint/config key, rendering mode, and persistence choice are identified.

## 2. Install the package

Install the selected package using the app's package manager. Vue bindings/UI require Vue 3.5+. The UI package installs its core/binding dependencies and includes compiled CSS, icons, assistant-ui, and Reka integration.

If the requested version is unavailable on npm, report the registry error. For an explicitly requested source integration, clone the repository, run `pnpm install --frozen-lockfile` and `pnpm release:prepare`, and install all three matching tarballs from `artifacts/` into the app. Use portable vendored paths if those dependencies must travel with the app.

Completion: the lockfile resolves the selected package and its matching sibling versions.

## 3. Add the host

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

Completion: one client-side host mounts, its launcher opens the packaged chat, and the stylesheet loads.

## 4. Wire the chosen branch

**Default UI:** pass the binding through `:chat`. The UI handles authentication, default workspace selection, conversation/model controls, and attachments. Customize through `theme`, `messages`, `errors`, and slots. Read the Vue UI README before replacing slots or composing its parts.

**Headless Vue:** call `useWispChat` inside setup. Read `state.value` in script and invoke `client` actions. The composable owns startup/disposal; the application owns its forms and control flow.

**Core:** create one client with `createWispChat({ url })`, subscribe to snapshots, then call `start()`. Call the returned unsubscribe function and `dispose()` on teardown.

For a custom interface, narrow snapshots by `status` before reading account/workspace data. A workspace is chat-ready only when `workspace.status === 'ready'`. Select a workspace before a model/conversation. Model IDs come from `workspace.models`. Handle rejected operations in the UI.

The public action signatures are in `packages/core/src/types.ts` or the installed `dist/types.d.ts`. Use those declarations as the API authority. Login uses `client.auth.signIn({ username, password })`; sending uses `client.conversations.send({ text, files })`. Password values come from the user's form and remain transient.

Completion: the chosen UI branch uses the public SDK and has one lifecycle owner.

## 5. Match the app

Use `theme` for app colors/fonts. Defaults are usable without overrides. Theme values accept CSS colors and variables and are copied to portaled menus. All Wisp style names use the `wisp-` prefix.

Import packaged CSS once. Keep the installed package's UI primitives and compiled styles; host framework components, Tailwind plugins, icon fonts, and React aliases are unnecessary. Supply credentials through Wisp's login flow rather than application environment variables. A separate app login may control where the host mounts, but does not authenticate CloudflareOS.

Completion: the chat fits the app's layout/theme and contains no shared credentials or duplicated SDK logic.

## 6. Verify the integration

Run the app's type check and production build. In a browser, open the launcher, sign in, switch workspaces and models, start/reopen a conversation, send a message, and close/reopen the panel. If persistence was enabled, refresh and verify restored account/workspace/thread selection. Verify sign-out clears local state. Exercise attachments if the app needs them.

If native credentials/resources or browser access are unavailable, report the blocked checks explicitly; passing builds are not proof of a native chat round trip. For a failed cross-origin connection, verify browser reachability and the server's origin/auth configuration before changing the SDK.

Completion: report the installed version, host/config file paths, public endpoint configuration key, and checks actually completed.
