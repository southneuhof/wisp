import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { sameArchiveContents } from './archive.mjs'
test('compares package file bytes while ignoring tar order and platform metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'wisp-archives-'))
  try {
    mkdirSync(join(root, 'package'))
    writeFileSync(join(root, 'package/a.js'), 'export const a = 1')
    writeFileSync(join(root, 'package/b.js'), 'export const b = 2')
    execFileSync('tar', [
      '-czf',
      join(root, 'one.tgz'),
      '-C',
      root,
      'package/a.js',
      'package/b.js',
    ])
    chmodSync(join(root, 'package/a.js'), 0o600)
    execFileSync('tar', [
      '-czf',
      join(root, 'two.tgz'),
      '-C',
      root,
      'package/b.js',
      'package/a.js',
    ])
    assert.equal(
      sameArchiveContents(join(root, 'one.tgz'), join(root, 'two.tgz')),
      true,
    )
    writeFileSync(join(root, 'package/a.js'), 'export const a = 3')
    execFileSync('tar', [
      '-czf',
      join(root, 'three.tgz'),
      '-C',
      root,
      'package/a.js',
      'package/b.js',
    ])
    assert.equal(
      sameArchiveContents(join(root, 'one.tgz'), join(root, 'three.tgz')),
      false,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ignores dependency ordering but preserves meaningful manifest changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'wisp-manifests-'))
  try {
    mkdirSync(join(root, 'package'))
    function pack(name, manifest) {
      writeFileSync(
        join(root, 'package/package.json'),
        JSON.stringify(manifest),
      )
      execFileSync('tar', [
        '-czf',
        join(root, name),
        '-C',
        root,
        'package/package.json',
      ])
      return join(root, name)
    }
    const first = pack('one.tgz', {
      name: 'wisp',
      dependencies: { a: '1', b: '2' },
      exports: { import: './import.js', default: './default.js' },
    })
    const reordered = pack('two.tgz', {
      name: 'wisp',
      dependencies: { b: '2', a: '1' },
      exports: { import: './import.js', default: './default.js' },
    })
    assert.equal(sameArchiveContents(first, reordered), true)
    const changed = pack('three.tgz', {
      name: 'wisp',
      dependencies: { a: '9', b: '2' },
      exports: { import: './import.js', default: './default.js' },
    })
    assert.equal(sameArchiveContents(first, changed), false)
    const conditions = pack('four.tgz', {
      name: 'wisp',
      dependencies: { a: '1', b: '2' },
      exports: { default: './default.js', import: './import.js' },
    })
    assert.equal(sameArchiveContents(first, conditions), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
