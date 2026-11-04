import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
function tar(args) {
  const result = spawnSync('tar', args)
  if (result.status !== 0) throw new Error('Could not inspect package archive')
  return result.stdout
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
    createHash('sha256')
      .update(tar(['-xOf', path, name]))
      .digest('hex'),
  ])
}
export function sameArchiveContents(first, second) {
  return (
    JSON.stringify(archiveContents(first)) ===
    JSON.stringify(archiveContents(second))
  )
}
