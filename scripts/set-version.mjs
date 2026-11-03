import { readFileSync, writeFileSync } from 'node:fs'
const version = process.argv[2]
if (
  !version ||
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
    version,
  )
)
  throw new Error('Usage: pnpm release:version <semver>')
for (const path of [
  'package.json',
  ...['core', 'vue', 'vue-ui'].map((name) => `packages/${name}/package.json`),
]) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  manifest.version = version
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n')
}
console.log(
  `All Wisp packages now target ${version}. Run pnpm install and pnpm release:prepare before tagging v${version}.`,
)
