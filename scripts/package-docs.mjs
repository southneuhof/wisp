import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
copyFileSync(
  resolve(process.cwd(), '../../docs/agent-integration.md'),
  resolve(process.cwd(), 'INTEGRATION.md'),
)
