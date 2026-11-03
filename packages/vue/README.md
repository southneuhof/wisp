# @southneuhof/wisp-vue

Agents integrating this package: read the [integration guide](https://github.com/southneuhof/wisp/blob/main/docs/agent-integration.md), also included as `INTEGRATION.md` in this package.

Headless Vue bindings for Wisp's CloudflareOS chat SDK.

```sh
npm install @southneuhof/wisp-vue vue
```

```vue
<script setup lang="ts">
import { useWispChat } from '@southneuhof/wisp-vue'
const { state, client } = useWispChat({ url: 'https://os.example.com' })
</script>

<template>
  <p>{{ state.status }}</p>
</template>
```

The composable returns the core `client`, read-only `state` ref, and public endpoint `url`. Initialization and disposal follow the Vue setup scope. Core actions provide authentication, workspaces, models, conversations, and attachments. No ready-made UI runtime or stylesheet is included. Vue 3.5 or later is a peer dependency.

Use `@southneuhof/wisp-vue-ui` for the default floating interface. See the [repository documentation](https://github.com/southneuhof/wisp#readme) for lifecycle and persistence options. MIT licensed.
