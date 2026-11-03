import { dirname, join, parse } from 'node:path'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import type { Plugin } from 'vite'

/** Keep license notices with dependencies bundled into the UI artifact. */
export function thirdPartyNotices(): Plugin {
  return {
    name: 'wisp-third-party-notices',
    generateBundle() {
      const packages = new Map<string, string>()
      for (const id of this.getModuleIds()) {
        if (!id.includes('/node_modules/') || id.startsWith('\0')) continue
        let directory = dirname(id.split('?')[0] ?? id)
        while (directory !== parse(directory).root) {
          const manifestPath = join(directory, 'package.json')
          if (existsSync(manifestPath)) {
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
            if (
              typeof manifest.name === 'string' &&
              typeof manifest.version === 'string'
            ) {
              const name = `${manifest.name}@${manifest.version}`
              if (!packages.has(name)) {
                const notices = readdirSync(directory)
                  .filter((name) =>
                    /^(licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(name),
                  )
                  .map(
                    (name) =>
                      `${name}\n${readFileSync(join(directory, name), 'utf8')}`,
                  )
                if (!notices.length)
                  this.error(`Missing bundled license notice for ${name}`)
                packages.set(
                  name,
                  `${name}\nLicense: ${manifest.license ?? 'See included notices'}\n\n${notices.join('\n\n')}`,
                )
              }
              break
            }
          }
          directory = dirname(directory)
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD_PARTY_NOTICES.txt',
        source:
          'Wisp bundles the following third-party software. Their license notices follow.\n\n' +
          [...packages.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, notice]) => notice)
            .join('\n\n' + '='.repeat(72) + '\n\n'),
      })
    },
  }
}
