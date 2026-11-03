# @southneuhof/wisp-vue-ui

`WispChat` is the default floating Vue interface. It includes the launcher, blurred backdrop, chat/composer transitions, sign-in stage, conversation picker, workspace submenu, model picker, attachments, and message rendering.

```vue
<script setup lang="ts">
import { WispChat, useWispChat } from '@southneuhof/wisp-vue-ui'
import '@southneuhof/wisp-vue-ui/style.css'

const chat = useWispChat({
  url: 'https://os.example.com',
  sessionPersistence: 'session',
})
</script>

<template>
  <WispChat :chat="chat" />
</template>
```

The component uses assistant-ui's Vue primitives and Reka UI directly. The package includes its own SVG icons, spinner, circular icon button, markdown renderer, and compiled styles. Consumers need Vue 3.5 and the SDK packages; they do not need HKA components, a CSS framework configuration, an icon font, or React aliases. The build handles assistant-ui's standalone shim internally.

The caller owns the chat binding. Closing the panel preserves the session and draft. Unmounting the owner disposes its client. Authentication persistence remains an explicit composable option.

## Theme

Pass a partial `WispChatTheme` through `theme`. Values are CSS colors, so they can reference an application's CSS variables. The font family can also be configured. Defaults work without any host stylesheet.

```vue
<WispChat
  :chat="chat"
  :theme="{
    fontFamily: 'system-ui, sans-serif',
    accent: '#7c3aed',
    primaryForeground: '#ffffff',
    background: '#ffffff',
    foreground: '#18181b',
    muted: '#71717a',
    border: '#e4e4e7',
    userMessage: '#f3e8ff',
    userMessageForeground: '#18181b',
    menuBackground: '#ffffff',
    menuHover: '#f4f4f5',
    danger: '#b42318',
  }"
/>
```

The palette is applied to the floating panel and all portaled menus. Styles and utility classes use the package's `wisp-` and `wisp-` names, with isolated utility variables and no global reset. Motion respects `prefers-reduced-motion`.

## Reusable parts

The package exports `ChatConversationPicker`, `ChatModelPicker`, `ChatOptionsMenu`, `ChatSignIn`, `ChatIconButton`, `ChatIcon`, `ChatSpinner`, and `useChatTheme` for composing custom interfaces. Menu components receive data and actions through typed props/events and use Reka primitives internally.

`ChatMessage`, `ChatMarkdown`, and `ChatAttachmentPreview` consume assistant-ui context and can be used inside an assistant-ui Vue provider. `ChatAttachment` accepts a native SDK attachment and chat binding directly.

## Customization

`messages` accepts copy overrides; `errors` maps SDK error codes to display text. The `header` slot receives the account, workspace list, workspace state, snapshot, busy state, and actions. It replaces the default header. The `controls` slot adds custom controls. `message` replaces message rendering within the assistant-ui context, and `composer-actions` adds composer controls. `title` labels the launcher.
