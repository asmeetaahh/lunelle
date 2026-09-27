// Metro needs explicit config to resolve `/shared` — it lives one level above
// this package (`../shared`, a sibling of `frontend/` at the repo root), and
// Metro's default project root is this package, not the repo root.
//
// `watchFolders` is what actually matters here: without it, Metro's resolver
// may find `../shared/*.ts` once (a plain relative import) but won't watch it
// for changes, and in some monorepo layouts won't resolve it at all. This is
// the standard Expo/Metro monorepo pattern — see
// https://docs.expo.dev/guides/monorepos/.
//
// `/shared` is not an npm package (no package.json of its own) — it is plain
// TypeScript, imported by relative or `@shared/*` path, never installed.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]

// Metro (unlike Node) does not walk up past projectRoot for node_modules by
// default in a watched-sibling layout — this keeps resolution working for
// this package's own dependencies once watchFolders widens the search root.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')]

module.exports = config
