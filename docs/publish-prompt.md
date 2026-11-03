# Publish Wisp to npm

Copy the following prompt to a coding agent:

```text
Publish the prepared Wisp 0.2.0 release from this repository checkout.
The repository is https://github.com/southneuhof/wisp.
Read AGENTS.md and docs/publishing.md first.

Publish these public packages in dependency order:
@southneuhof/wisp-core, @southneuhof/wisp-vue, @southneuhof/wisp-vue-ui.
MIT is approved. Preserve unrelated changes. Verify the clean release commit,
matching versions, GitHub CI, npm identity, and npm southneuhof org access.
Run the release checks, commit/push any approved release preparation changes,
and create or verify the matching local v0.2.0 tag. Use pnpm release:publish.
Pause for me to complete any npm browser login or 2FA approval; never request
my password, recovery codes, or a token in chat. After publication, verify all
three registry versions, install the registry packages in a clean Vue consumer,
and check its build. Push the version tag only after successful publication or
once trusted publishing has been configured. Report package links and results.
```
