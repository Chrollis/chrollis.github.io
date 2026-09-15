/*
 * Contact-form rule verification (`npm run test:contact`).
 *
 * The email rules are the part of this form that is easy to get wrong in a way nobody
 * notices: a pattern one character too strict rejects a real address, and the person who
 * typed it is told nothing except that they cannot send. So the table pins **both**
 * directions - what we refuse, and what we deliberately accept even though it looks
 * unusual (`+` tags, mixed case, a one-character local part, an IDN domain, a name that is
 * not Latin at all).
 *
 * Node 24 runs the TypeScript module directly, so this exercises the function the site
 * ships rather than a copy - which is also why `src/lib/validate.ts` imports nothing.
 */
import { CONTACT_FIELDS, validateContact, validateField } from '../src/lib/validate.ts'

let failures = 0
/** Every code the table produced, so a rule that can never fire shows up as a gap. */
const seen = new Set()

function check(label, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) {
    console.log(`        expected ${String(expected)}`)
    console.log(`        actual   ${String(actual)}`)
  }
}

/** One field, one value. The label carries the case, so a failure needs no detective work. */
const field = (name, value, expected) => {
  const actual = validateField(name, value)
  if (actual) seen.add(actual)
  check(
    `${name.padEnd(6)} ${JSON.stringify(value).slice(0, 32).padEnd(34)} -> ${String(expected)}`,
    actual,
    expected,
  )
}

/* --- required: whitespace is not a value ------------------------------ */

field('name', '', 'required')
field('name', '   ', 'required')
field('name', '\t\n', 'required')
field('message', '', 'required')
field('email', '', 'required')
field('email', '   ', 'required')

/* --- accepted on purpose ---------------------------------------------- */

field('name', '王', undefined)
field('name', ' 李雷 ', undefined)
field('name', 'Chrollis', undefined)
field('name', 'emoji 🐟 name', undefined)
field('message', 'hi', undefined)
field('email', 'me@example.com', undefined)
field('email', '  me@example.com  ', undefined)
field('email', 'you+site@example.co.uk', undefined)
field('email', 'ME@EXAMPLE.COM', undefined)
field('email', '用户@例子.中国', undefined)
field('email', 'a@b.co', undefined)

/* --- refused ---------------------------------------------------------- */

field('email', 'john', 'emailMissingAt')
field('email', '@example.com', 'emailMissingAt')
field('email', 'me@', 'emailMissingAt')
field('email', 'a@b', 'emailIncompleteDomain')
field('email', 'a@b.c', 'emailIncompleteDomain')
field('email', 'a@b.com.', 'emailIncompleteDomain')
field('email', 'a@.com', 'emailIncompleteDomain')
field('email', 'a@b@c.com', 'emailUnusable')
field('email', 'a b@c.com', 'emailUnusable')
field('email', 'a,b@c.com', 'emailUnusable')
field('email', `${'x'.repeat(250)}@example.com`, 'emailUnusable')

/* --- fields with no rules never fail ---------------------------------- */

field('subject_custom', '', undefined)
field('subject_custom', 'anything at all', undefined)

/* --- the whole form --------------------------------------------------- */

const form = (over = {}) => ({ name: '', email: '', message: '', ...over })

check(
  'blank form reports every required field, in reading order',
  JSON.stringify(validateContact(form())),
  JSON.stringify({ name: 'required', email: 'required', message: 'required' }),
)
check(
  'one bad address among good values reports only that field',
  JSON.stringify(validateContact(form({ name: '王', email: 'me@example', message: 'hi' }))),
  JSON.stringify({ email: 'emailIncompleteDomain' }),
)
check(
  'a complete form reports nothing',
  JSON.stringify(validateContact(form({ name: '王', email: 'me@example.com', message: 'hi' }))),
  '{}',
)

/* --- the table has to stay honest ------------------------------------- */

check(
  'every validated field is covered by the table',
  CONTACT_FIELDS.every((name) => validateField(name, '') === 'required'),
  true,
)
check(
  'every code is reachable',
  [...seen].sort().join(','),
  'emailIncompleteDomain,emailMissingAt,emailUnusable,required',
)

console.log('')
console.log(failures === 0 ? 'all checks passed' : `${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
