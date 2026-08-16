#!/usr/bin/env node
/**
 * Emit the browser factory bundle at lib/client.js.
 *
 * dsh client-modules serves this file as a classic script. It must register
 * through window.__ModuleLoader__.load and resolve `react` via the injected
 * require — a tsc ESM emit will not load.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * Turn `*.module.css` into a class-name map and inject the rewritten CSS
 * once. The served factory is a single JS file; a sibling CSS asset would
 * never load.
 */
function cssModulesPlugin() {
  return {
    name: 'css-modules-inject',
    setup(buildApi) {
      buildApi.onLoad({ filter: /\.module\.css$/ }, (args) => {
        const source = readFileSync(args.path, 'utf8')
        const locals = {}
        const rewritten = source.replace(/\.([A-Za-z_][\w]*)/g, (_, name) => {
          if (locals[name] === undefined) locals[name] = `phw_${name}`
          return `.${locals[name]}`
        })
        const js = `
const css = ${JSON.stringify(rewritten)};
if (typeof document !== 'undefined') {
  const id = 'pihuo-workers-css';
  if (document.getElementById(id) === null) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }
}
export default ${JSON.stringify(locals)};
`
        return { contents: js, loader: 'js' }
      })
    },
  }
}

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const id = pkg.name
if (typeof id !== 'string' || id === '') {
  throw new Error('ui-acp-worker: package.json name is required for the client handoff id')
}

await build({
  absWorkingDir: root,
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/dsh-client-ui-primitives',
  ],
  plugins: [cssModulesPlugin()],
  logOverride: { 'empty-import-meta': 'silent' },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
})
