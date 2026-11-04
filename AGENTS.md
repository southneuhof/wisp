# Wisp

- Integration: read `docs/agent-integration.md` before adding Wisp to an app, choosing registry versus source installation, or wiring a custom UI.
- Publishing: read `docs/publishing.md` before changing versions, creating release tags, or publishing packages. `docs/publish-prompt.md` is the release handoff.
- Package boundaries: core owns protocol/state; Vue and React bindings own framework lifecycle/reactivity; their UI packages own presentation and UI dependencies. `shared/chat.css` owns visual styles used by both interfaces. Keep host application dependencies outside these packages.
- Validation: run `pnpm release:prepare` before a release. Use the scripts and package declarations as the command/API authority.
- Documentation: `docs/agent-integration.md` is the source for packaged `INTEGRATION.md` files. Update the source; prepack creates the copies.
