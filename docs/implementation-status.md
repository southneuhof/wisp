# Architecture and verification

Wisp is a browser SDK for CloudflareOS with optional Vue bindings and a floating Vue interface. It connects directly to the configured CloudflareOS endpoint using the end user's native account.

## Package boundaries

- `@southneuhof/wisp-core` owns authentication, workspace and conversation state, streaming/history reconciliation, attachment validation/uploads/downloads, cancellation, and connection recovery. Snapshots exclude passwords, account tokens, and RPC capabilities. Scope guards reject late responses after account, workspace, or conversation changes.
- `@southneuhof/wisp-vue` owns a core client within a Vue setup scope, exposes a read-only state ref, starts on mount, and disposes on scope destruction. It imports no UI, markdown renderer, assistant-ui, or Reka runtime.
- `@southneuhof/wisp-vue-ui` owns the default floating interface and reusable presentation components. It uses assistant-ui Vue primitives with an external-store adapter and Reka menu primitives. Styling, icons, animations, and the theme system are packaged here. Consumers require no host framework components, CSS build configuration, or React aliases.

Application integrations provide the public endpoint and optional theme/persistence settings. No backend helper, shared service-account credentials, application database, MCP implementation, or business-data authorization layer is included.

## Validation

`pnpm release:prepare` runs formatting, package/example/test type checks, behavioral tests, package and example builds, clean-consumer installation, declaration checks, and release-content inspection.

Core tests use a controlled native RPC boundary and real Cap'n Web subscriber targets. They cover scoped late responses, overlapping selections, workspace creation, role restrictions, streaming/history reconciliation, attachment bytes, file-only messages, cancellation, persistence, reconnect, and disposal. UI tests exercise credentials, native Reka menu interactions, portaled theme propagation, workspace switching, file drops, and lifecycle handling. These tests do not establish native model quality or server-side authorization behavior.

The package verification script checks production builds in a fresh npm consumer, declarations under Bundler and legacy Node resolution, a browser-global-free core import, and forbidden UI dependencies in core/headless consumers. The release script checks archive contents, licenses, repository metadata, and registry-compatible sibling dependencies.

Native endpoint and real-browser checks are separate from this automated suite. Use the example applications against your instance to validate your authentication configuration and native resources before deployment.

## Current limits

Initial support targets password-enabled CloudflareOS through its native Cap'n Web `/api` interface. Cloudflare Access cross-origin sign-in and upstream resource-configuration interfaces are outside this package. Configure resources through CloudflareOS.

Memory-only sessions are the default. Optional per-tab persistence stores a native token and selections, never passwords. Sign-out clears local state but does not revoke the upstream account token. Cancelled uploads can leave bytes already accepted upstream, and uncertain mutations are not automatically resent. Separate client instances have independent in-memory state.

Compatibility storage keys retain their earlier `os-chat:` prefix so the Wisp rename does not discard existing per-tab sessions or saved model selections. Public package names, APIs, CSS classes, and theme variables use Wisp naming.
