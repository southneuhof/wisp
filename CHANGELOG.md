# Changelog

## 0.4.2

- The launcher morphs into the chat composer and back in Vue and React. The messages and toolbar sharpen as they appear, and the composer clips its contents to the expanding card.
- The chat respects reduced-motion preferences and restores focus to the launcher on close.
- MCP approval cards show readable arguments and hide private connector URL paths. Connector inspection is summarized in the transcript.

## 0.2.0 — initial public release (prepared)

- Framework-independent CloudflareOS SDK with native account authentication, workspaces, conversations, streaming/history, attachments, cancellation, and recovery.
- Headless Vue binding with scope-owned initialization and disposal.
- Self-contained floating Vue chat, built with assistant-ui and Reka primitives, with reusable menus, sign-in, message/attachment rendering, SVG icons, and circular icon buttons.
- Configurable monochrome theme, portaled menu colors, pinned conversation/workspace actions, and blur/zoom transitions with reduced-motion support.
- Optional per-tab account/workspace/thread persistence; passwords remain transient.
- ESM packages with TypeScript declarations, compiled isolated styles, dependency notices, examples, and clean-consumer checks.
- GitHub CI and npm trusted-publishing workflow for `southneuhof/wisp`.
