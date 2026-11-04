import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
function tar(args) {
  const result = spawnSync('tar', args)
  if (result.status !== 0) throw new Error('Could not inspect package archive')
  return result.stdout
}
function fileContents(path, name) {
  const bytes = tar(['-xOf', path, name])
  if (name !== 'package/package.json') return bytes
  const manifest = JSON.parse(bytes.toString('utf8'))
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    if (manifest[field])
      manifest[field] = Object.fromEntries(
        Object.entries(manifest[field]).sort(([a], [b]) => a.localeCompare(b)),
      )
  }
  return Buffer.from(JSON.stringify(manifest))
}
export function archiveContents(path) {
  const entries = tar(['-tzf', path])
    .toString('utf8')
    .trim()
    .split('\n')
    .filter((name) => !name.endsWith('/'))
    .sort()
  return entries.map((name) => [
    name,
    createHash('sha256').update(fileContents(path, name)).digest('hex'),
  ])
}
export function sameArchiveContents(first, second) {
  return (
    JSON.stringify(archiveContents(first)) ===
    JSON.stringify(archiveContents(second))
  )
}
