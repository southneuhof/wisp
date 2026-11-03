import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const repository = 'git+https://github.com/southneuhof/wisp.git'
const names = ['core', 'vue', 'vue-ui']
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const workspace = readJson(resolve(root, 'package.json'))
const publish = process.argv.includes('--publish')
function assert(condition, message) {
  if (!condition) throw new Error(message)
}
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`,
    )
  return result.stdout.trim()
}
const license = readFileSync(resolve(root, 'LICENSE'), 'utf8')
const packages = names.map((directory) => {
  const manifest = readJson(
    resolve(root, 'packages', directory, 'package.json'),
  )
  assert(
    manifest.version === workspace.version,
    `${manifest.name}: release versions must match`,
  )
  assert(
    manifest.license === 'MIT',
    `${manifest.name}: review the release license`,
  )
  assert(
    manifest.repository?.url === repository &&
      manifest.repository.directory === `packages/${directory}`,
    `${manifest.name}: invalid repository metadata`,
  )
  assert(
    manifest.publishConfig?.access === 'public',
    `${manifest.name}: public npm access is required`,
  )
  const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`
  const tarball = resolve(root, 'artifacts', filename)
  const files = new Set(run('tar', ['-tzf', tarball]).split('\n'))
  for (const file of files)
    assert(
      /^package\/(dist\/[^\n]+|package\.json|README\.md|INTEGRATION\.md|LICENSE)$/.test(
        file,
      ),
      `Unexpected release file: ${file}`,
    )
  assert(
    files.has('package/INTEGRATION.md'),
    `${manifest.name}: missing agent integration guide`,
  )
  const packed = JSON.parse(
    run('tar', ['-xOf', tarball, 'package/package.json']),
  )
  assert(
    !packed.private &&
      packed.name === manifest.name &&
      packed.version === manifest.version,
    `${manifest.name}: incorrect packed manifest`,
  )
  assert(
    run('tar', ['-xOf', tarball, 'package/LICENSE']) === license.trim(),
    `${manifest.name}: missing or inconsistent license`,
  )
  for (const [name, range] of Object.entries(packed.dependencies ?? {})) {
    assert(
      !/^(workspace:|file:|link:)/.test(range),
      `${manifest.name}: non-registry dependency ${name}`,
    )
    if (name.startsWith('@southneuhof/wisp-'))
      assert(
        range === workspace.version,
        `${manifest.name}: sibling release version mismatch`,
      )
  }
  for (const file of ['index.js', 'index.d.ts'])
    assert(
      files.has(`package/dist/${file}`),
      `${manifest.name}: missing ${file}`,
    )
  if (directory === 'vue-ui') {
    assert(files.has('package/dist/style.css'), 'Missing Vue UI stylesheet')
    assert(
      files.has('package/dist/THIRD_PARTY_NOTICES.txt'),
      'Missing bundled dependency notices',
    )
  }
  const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`
  console.log(`${manifest.name}@${manifest.version}: release contents verified`)
  return { manifest, tarball, integrity }
})
if (!publish) {
  console.log(
    `Wisp ${workspace.version} is prepared. Nothing has been published.`,
  )
  process.exit(0)
}
assert(
  run('git', ['status', '--porcelain']) === '',
  'Commit release changes before publishing',
)
assert(
  run('git', ['describe', '--tags', '--exact-match', 'HEAD']) ===
    `v${workspace.version}`,
  `Check out release tag v${workspace.version}`,
)
if (process.env.GITHUB_ACTIONS === 'true') {
  assert(
    process.env.GITHUB_REPOSITORY === 'southneuhof/wisp',
    'Publishing is restricted to southneuhof/wisp',
  )
} else {
  run('npm', ['whoami', '--registry=https://registry.npmjs.org/'])
}
for (const { manifest, tarball, integrity } of packages) {
  const existing = spawnSync(
    'npm',
    [
      'view',
      `${manifest.name}@${manifest.version}`,
      'dist.integrity',
      '--json',
      '--registry=https://registry.npmjs.org/',
    ],
    { encoding: 'utf8' },
  )
  if (existing.status === 0) {
    assert(
      JSON.parse(existing.stdout) === integrity,
      `${manifest.name}@${manifest.version} exists with different contents; choose a new version`,
    )
    console.log(
      `${manifest.name}@${manifest.version} already published with matching contents`,
    )
    continue
  }
  assert(
    /E404/.test(existing.stderr),
    `Registry preflight failed: ${existing.stderr}`,
  )
  const result = spawnSync(
    'npm',
    [
      'publish',
      tarball,
      '--access=public',
      '--ignore-scripts',
      '--registry=https://registry.npmjs.org/',
      '--tag',
      manifest.version.includes('-') ? 'next' : 'latest',
    ],
    { stdio: 'inherit' },
  )
  assert(
    result.status === 0,
    `Publishing failed for ${manifest.name}; resolve the registry error before rerunning`,
  )
}
