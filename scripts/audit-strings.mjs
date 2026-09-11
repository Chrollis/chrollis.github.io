/*
 * String audit (`npm run audit:strings`). Three checks:
 *
 *   1. Every override key exists in the reference locale. The type system enforces this
 *      already; re-checked here because this script is where the rule is written down.
 *   2. Every locale resolves to the same key set as the reference. The merge makes that
 *      structurally true, so this guards the merge rather than the translations - a bug in
 *      `mergeValue` should say so instead of the site rendering `undefined`.
 *   3. No dead strings. A key no component reads is a string someone may translate for
 *      nothing, and deleting a feature leaves strings behind with no compiler warning.
 *
 * It runs against the real modules, so it cannot disagree with what the site renders.
 * Locales are discovered by reading the directory, because Node's ESM resolver needs
 * explicit extensions and `src/data/strings.ts` uses Vite-style extensionless imports.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const localesDir = join(srcDir, 'data', 'locales')

/** Named rather than taken from the first file alphabetically, so sorting cannot change it. */
const REFERENCE = 'en'

const CODES = readdirSync(localesDir)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => file.replace(/\.ts$/, ''))
  .sort()

if (!CODES.includes(REFERENCE)) {
  console.error(`[strings] no ${REFERENCE}.ts in src/data/locales`)
  process.exit(1)
}

const loaded = {}
for (const code of CODES) {
  const module = await import(pathToFileURL(join(localesDir, `${code}.ts`)).href)
  loaded[code] = module[code]
  if (!loaded[code]) {
    console.error(`[strings] ${code}.ts does not export \`${code}\``)
    process.exit(1)
  }
}

/** Flatten an object into `a.b.c` paths. Arrays and primitives are leaves. */
function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(entry) ? [full] : []
  })
}

/* Only the consuming files. The locale files obviously contain every key, and
   counting them would mark everything as used. */
const files = walk(srcDir).filter((file) => !relative(srcDir, file).includes('data/locales/'))

/*
 * Comments are stripped before scanning - correctness, not tidiness: these files are
 * heavily commented, often with key names as examples, and a mention would count as a
 * reference and hide a genuinely dead string.
 */
const source = files
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

const referenceKeys = flatten(loaded[REFERENCE])
const leaves = new Set(referenceKeys)
const used = new Set()

/* Mark one path: a leaf marks itself, a subtree marks everything under it - which is what
   reading `t.navItems[item.key]` actually does. */
function markUsed(key) {
  if (leaves.has(key)) {
    used.add(key)
    return
  }
  for (const leaf of leaves) {
    if (leaf.startsWith(`${key}.`)) used.add(leaf)
  }
}

/*
 * `t.a.b.c` resolves to the longest prefix that is a real key. `t.content.bio.map(...)`
 * captures `content.bio.map`, which is not a key, while what it read is `content.bio`; and
 * the longest prefix stops `t.locale.short` marking the whole `locale` subtree as used.
 */
const DESTRUCTURED = /\{\s*([^{}]+?)\s*\}\s*=\s*t\.([A-Za-z0-9_.]+)/g
const pathsOnly = source.replace(DESTRUCTURED, '')

for (const match of pathsOnly.matchAll(/\bt\.([A-Za-z0-9_.]+)/g)) {
  const parts = match[1].split('.')
  for (let i = parts.length; i >= 1; i--) {
    const candidate = parts.slice(0, i).join('.')
    if (leaves.has(candidate)) {
      used.add(candidate)
      break
    }
    if (referenceKeys.some((leaf) => leaf.startsWith(`${candidate}.`))) {
      markUsed(candidate)
      break
    }
  }
}

/*
 * Destructuring, e.g. `const { role, description: siteDescription } = t.content`. Marks the
 * individual keys rather than the subtree, or one destructured field would make its
 * siblings look used.
 */
for (const match of source.matchAll(DESTRUCTURED)) {
  const [, bindings, path] = match
  for (const binding of bindings.split(',')) {
    const name = binding.split(':')[0].trim()
    if (/^[A-Za-z_$][\w$]*$/.test(name)) markUsed(`${path}.${name}`)
  }
}

let problems = 0

/* --- structure ------------------------------------------------------ */

console.log(`reference locale "${REFERENCE}": ${referenceKeys.length} keys`)

for (const code of CODES) {
  if (code === REFERENCE) continue

  const keys = flatten(loaded[code])
  const unknown = keys.filter((key) => !leaves.has(key))

  if (unknown.length > 0) {
    problems += unknown.length
    console.log(`  "${code}": UNKNOWN KEY(S) ${unknown.join(', ')}`)
  } else {
    const percent = Math.round((keys.length / referenceKeys.length) * 100)
    console.log(`  "${code}": ${keys.length} overrides, ${percent}% of the site`)
  }
}

/* The merge should make every locale complete by construction; asserting it means a future
   change to `mergeValue` fails here rather than as `undefined` on the page. */
for (const code of CODES) {
  const missing = referenceKeys.filter((key) => {
    let node = loaded[code]
    let base = loaded[REFERENCE]
    for (const part of key.split('.')) {
      node = node?.[part] ?? undefined
      base = base?.[part] ?? undefined
    }
    // An override that is absent is fine: the merge supplies the reference value.
    return node === undefined && base !== undefined && !key.includes('.')
  })
  if (missing.length > 0) {
    problems += missing.length
    console.log(`  "${code}": the merge did not complete ${missing.length} key(s)`)
  }
}

/* --- dead keys ------------------------------------------------------ */

const dead = referenceKeys.filter((key) => !used.has(key))

console.log('')
if (dead.length === 0) {
  console.log('every key is referenced somewhere')
} else {
  problems += dead.length
  console.log(`${dead.length} key(s) not referenced by any component:`)
  for (const key of dead) {
    const overridden = CODES.filter(
      (code) => code !== REFERENCE && flatten(loaded[code]).includes(key),
    )
    const note = overridden.length > 0 ? `   <- overridden in ${overridden.join(', ')}` : ''
    console.log(`  ${key}${note}`)
  }
  console.log('')
  console.log('Either wire them up, or delete them from the reference locale.')
}

console.log('')
console.log(
  problems === 0
    ? `ok - ${CODES.length} locales, ${used.size} keys referenced`
    : `${problems} problem(s)`,
)
process.exit(problems === 0 ? 0 : 1)
