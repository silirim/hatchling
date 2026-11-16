// @ts-check
// The project is Hatchling. Its earlier name is written only where it must be: the page that tells how to move from it, the
// measured history, the bench arm and variables kept so that past series run again, and the reading of files exported under it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const OLD = /cachito/i
// folders that are not the project's text: installed code, generated types, private packs
const SKIP = ['.git', 'node_modules', 'packs-private', '__pycache__', '.claude-plugin/types']
// where the earlier name stays, and why
const KEPT = {
  'docs/renamed.md': 'the one page that says it: how to move a pet, the folders',
  'bench/RESULTS.md': 'history as measured, with a note at the top',
  'bench/arms/leanonly/text.js': 'the section of the past series, id and all, as it ran',
  'bench/arms.test.mjs': 'holds that arm to its id',
  'bench/run.mjs': 'sets the variables under both names for the copies of the mod kept with past series',
  'bench/tasks/gin/NOTES.md': 'paths of the machine the series ran on',
  'engine/move.js': 'reads a file exported under the earlier name',
  'engine/move.test.js': 'tests that reading',
  'engine/name.test.js': 'this test',
  'docs/piano.md': 'working notes, not in the repository',
  'docs/fase0-verifiche.md': 'working notes, not in the repository',
}
/** @type {(dir: string) => string[]} */
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const path = join(dir, e.name), rel = relative(ROOT, path).split(sep).join('/')
  return SKIP.includes(rel) || SKIP.includes(e.name) ? [] : e.isDirectory() ? walk(path) : [rel]
})
const TEXT = /\.(md|js|mjs|ts|json|py|sh|txt|svg|patch|go)$|^LICENSE$|^\.gitignore$/

test('nothing a person or a reader sees says the earlier name', () => {
  const files = walk(ROOT).filter(f => TEXT.test(f) && !Object.hasOwn(KEPT, f))
  for (const must of ['README.md', 'docs/pet.md', 'docs/privacy.md', 'docs/skins.md', 'bench/README.md', 'bench/METHOD.md', 'engine/lang/en.js', 'engine/lang/es.js', 'engine/lang/pt.js', 'engine/lang/zh.js',
    'hooks/register.js', 'briefox/hooks/register.js', 'package.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'briefox/.claude-plugin/plugin.json']) assert.ok(files.includes(must), `${must} is read`)
  const said = files.flatMap(f => readFileSync(join(ROOT, f), 'utf8').split('\n').flatMap((line, i) => OLD.test(line) ? [`${f}:${i + 1}`] : []))
  assert.deepEqual(said, [])
  assert.deepEqual(files.filter(f => OLD.test(f)), [], 'no file is named after it')
})

test('the manifests name the plugin and the marketplace hatchling, and the install lines say so', () => {
  const json = (/** @type {string} */ f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))
  const market = json('.claude-plugin/marketplace.json'), readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  assert.equal(json('.claude-plugin/plugin.json').name, 'hatchling')
  assert.equal(json('package.json').name, 'hatchling')
  assert.equal(market.name, 'hatchling')
  assert.deepEqual(market.plugins.map((/** @type {any} */ p) => p.name), ['briefox', 'hatchling'])
  for (const p of ['hatchling', 'briefox']) assert.ok(readme.includes(`/plugin install ${p} --marketplace silirim/hatchling`), p)
})
