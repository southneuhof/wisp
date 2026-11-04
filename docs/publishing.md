# Publishing Wisp

Repository: https://github.com/southneuhof/wisp

The root workspace is private. The public npm packages are `@southneuhof/wisp-core`, `@southneuhof/wisp-vue`, `@southneuhof/wisp-vue-ui`, `@southneuhof/wisp-react`, and `@southneuhof/wisp-react-ui`. They use matching versions; the first prepared public release is `0.2.0`.

## One-time setup

1. Review the MIT license in `LICENSE` before publishing the source or packages.
2. Create or obtain access to the npm organization `southneuhof`. The GitHub organization does not grant npm scope ownership. Ensure your npm account has publishing access to that organization.
3. Sign in on the release machine with `npm login`, then check `npm whoami` and `npm org ls southneuhof`. Never commit npm credentials.
4. Commit the reviewed source and push `main` to the configured `origin`. CI verifies the source and packages on pushes and pull requests.

Public scoped packages use `publishConfig.access: public`. The package repository metadata points to the matching subdirectory in `southneuhof/wisp`.

## Prepare a release

Use Node.js 24 and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm release:prepare
```

This checks formatting and types, runs the tests, builds packages/examples, installs the tarballs into a clean consumer, checks dependency separation, and inspects release contents. `artifacts/` contains the five publishable tarballs. Preparation does not publish anything.

The bundled Vue UI artifact includes `dist/THIRD_PARTY_NOTICES.txt` for bundled dependencies. Each package includes the project license and package-specific README. Source directories, credentials, local application configuration, and dependencies are excluded from the archives.

## First publication

Create an exact version tag on the clean, reviewed release commit. For the prepared release:

```sh
git tag v0.2.0
pnpm release:publish
```

The publish command requires a clean worktree and a matching version tag. It publishes the checked tarballs in dependency order: core, Vue bindings/UI, then React bindings/UI. Complete npm's interactive authentication when prompted. A failed partial release can be rerun: already published packages are skipped only when their registry integrity matches, or their verified archive file contents match despite tar metadata differences. A content mismatch requires a new version.

After the packages exist, configure npm trusted publishing for each package under its npm Settings:

- Provider: GitHub Actions
- Organization/user: `southneuhof`
- Repository: `wisp`
- Workflow filename: `publish.yml`
- Environment: leave empty (the workflow does not declare one)
- Allow direct publishing with `npm publish`

This uses GitHub OIDC instead of storing an npm publish token. A new trusted-publisher configuration currently needs its first successful publish within two days; configure it when ready for the next version. Follow npm's current setup documentation: https://docs.npmjs.com/trusted-publishers/

## Subsequent releases

```sh
pnpm release:version 0.2.1
pnpm install
pnpm release:prepare
git add .
git commit -m "Release Wisp 0.2.1"
git tag v0.2.1
git push origin main
git push origin v0.2.1
```

A pushed `v*` tag starts `.github/workflows/publish.yml`. It checks out that tag, repeats preparation, and publishes through npm trusted publishing. Prerelease versions use the `next` dist-tag; ordinary releases use `latest`.

The workflow can also be run manually against an existing tag. Its `publish` input defaults to false for a dry run. Publication is restricted to `southneuhof/wisp`. The workflow uses GitHub-hosted runners and grants `id-token: write`; no `NPM_TOKEN` secret is needed after trusted publishing is configured.
