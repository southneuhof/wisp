import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
const root = process.cwd(),
  artifacts = resolve(root, 'artifacts')
mkdirSync(artifacts, { recursive: true })
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed`)
}
for (const name of ['core', 'vue', 'vue-ui'])
  run(
    'pnpm',
    ['pack', '--pack-destination', artifacts],
    resolve(root, 'packages', name),
  )
const uiBundle = readFileSync(
  resolve(root, 'packages/vue-ui/dist/index.js'),
  'utf8',
)
const uiStyles = readFileSync(
  resolve(root, 'packages/vue-ui/dist/style.css'),
  'utf8',
)
if (
  /--md-sys-color-|material-symbols|AgenticBi|from ["']@\//.test(
    uiBundle + uiStyles,
  )
)
  throw new Error('Vue UI bundle contains application-specific dependencies')
if (/from ["']react(?:\/[^"']*)?["']/.test(uiBundle))
  throw new Error('Vue UI consumer would require React aliases')
const consumer = resolve(artifacts, 'consumer')
rmSync(consumer, { recursive: true, force: true })
mkdirSync(consumer)
writeFileSync(
  resolve(consumer, 'package.json'),
  JSON.stringify({
    name: 'package-verification',
    private: true,
    type: 'module',
  }),
)
run(
  'npm',
  [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...['core', 'vue', 'vue-ui'].map((name) => {
      const manifest = JSON.parse(
        readFileSync(resolve(root, 'packages', name, 'package.json'), 'utf8'),
      )
      return resolve(
        artifacts,
        `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`,
      )
    }),
    'vue@^3.5.0',
  ],
  consumer,
)
for (const [name, forbidden] of [
  [
    'core',
    ['vue', 'marked', '@southneuhof/wisp-vue', '@southneuhof/wisp-vue-ui'],
  ],
  ['vue', ['marked', '@southneuhof/wisp-vue-ui']],
]) {
  const manifest = JSON.parse(
    readFileSync(
      resolve(
        consumer,
        'node_modules',
        JSON.parse(
          readFileSync(resolve(root, 'packages', name, 'package.json'), 'utf8'),
        ).name,
        'package.json',
      ),
      'utf8',
    ),
  )
  for (const dependency of forbidden)
    if (dependency in (manifest.dependencies ?? {}))
      throw new Error(`${name} unexpectedly depends on ${dependency}`)
}
writeFileSync(
  resolve(consumer, 'index.html'),
  '<div id="app"></div><script type="module" src="/main.ts"></script>',
)
writeFileSync(
  resolve(consumer, 'main.ts'),
  "import {createApp} from 'vue';import App from './App.vue';createApp(App).mount('#app')",
)
writeFileSync(
  resolve(consumer, 'App.vue'),
  readFileSync(resolve(root, 'examples/vue-ready-made/App.vue'), 'utf8'),
)
writeFileSync(
  resolve(consumer, 'vite.config.mjs'),
  "import {defineConfig} from 'vite';import vue from '@vitejs/plugin-vue';export default defineConfig({plugins:[vue()]})",
)
run('pnpm', ['exec', 'vite', 'build', consumer])
writeFileSync(
  resolve(consumer, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      skipLibCheck: true,
      lib: ['ES2022', 'DOM'],
      types: ['vite/client'],
    },
    include: ['*.ts', '*.vue'],
  }),
)
run('pnpm', [
  'exec',
  'vue-tsc',
  '--noEmit',
  '-p',
  resolve(consumer, 'tsconfig.json'),
])
run('pnpm', [
  'exec',
  'vue-tsc',
  '--noEmit',
  '-p',
  resolve(consumer, 'tsconfig.json'),
  '--moduleResolution',
  'node',
])
for (const example of [
  {
    name: 'headless-vue',
    entry:
      "import { useWispChat } from '@southneuhof/wisp-vue'; document.body.textContent = typeof useWispChat",
    forbidden: [
      '@southneuhof/wisp-vue-ui',
      '/marked/',
      'reka-ui',
      '@assistant-ui',
    ],
  },
  {
    name: 'core',
    entry:
      "import { createWispChat } from '@southneuhof/wisp-core'; document.body.textContent = createWispChat({url:'https://os.example.com'}).getSnapshot().status",
    forbidden: [
      '@southneuhof/wisp-vue',
      '/vue/',
      '/marked/',
      '@vue/',
      'reka-ui',
      '@assistant-ui',
    ],
  },
]) {
  writeFileSync(resolve(consumer, 'main.ts'), example.entry)
  writeFileSync(
    resolve(consumer, 'vite.config.mjs'),
    `import {defineConfig} from 'vite';export default defineConfig({plugins:[{name:'dependency-boundaries',generateBundle(){for(const id of this.getModuleIds()){if(${JSON.stringify(example.forbidden)}.some(part=>id.includes(part)))this.error('Forbidden module in ${example.name}: '+id)}}}]})`,
  )
  run('pnpm', ['exec', 'vite', 'build', consumer])
}

run(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    "import {createWispChat} from '@southneuhof/wisp-core';const client=createWispChat({url:'https://os.example.com'});if(client.getSnapshot().status!=='signed-out')throw new Error('Bad initial state');client.dispose();console.log('Core imports without browser globals or UI runtime')",
  ],
  consumer,
)
console.log('Packed consumer build and dependency-boundary checks passed')
