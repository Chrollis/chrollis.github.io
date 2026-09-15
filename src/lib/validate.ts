/**
 * Contact-form rules, as a pure function over the raw field values.
 *
 * Pure on purpose - no DOM, no React, no strings. It returns **codes**; the component decides
 * what they read as and how they look (`t.contact.*`, in `ContactForm.tsx`). So the rules can
 * be checked in isolation, and the human check this form will grow later is one more field
 * and one more branch here rather than a second submission path.
 *
 * The email rules are deliberately shallow. A client-side check catches a typo; it cannot
 * decide whether an address exists - only delivery decides that - so anything a stricter
 * pattern would reject merely for looking unusual is accepted: `+` tags, mixed case, a
 * one-character local part, and non-ASCII (IDN) domains.
 *
 * It imports nothing, and that is a requirement rather than an accident: the case table that
 * checks these rules loads this file with a plain `node`, which resolves neither the `@/`
 * alias nor an extensionless import. `isBlank` in `data/site.ts` is the same one-line test,
 * and calling it here would buy a shared definition at the price of the file no longer being
 * loadable outside Vite.
 */

/** The fields that carry rules. `subject` is optional and has none. */
export type ContactField = 'name' | 'email' | 'message'

export type ContactValues = Record<ContactField, string>

/** What is wrong with a field, named for the reading the visitor gets, not for a sentence. */
export type ContactError = 'required' | 'emailMissingAt' | 'emailIncompleteDomain' | 'emailUnusable'

export type ContactErrors = Partial<Record<ContactField, ContactError>>

/** Reading order. The form focuses the first field in this order, not the object's key order. */
export const CONTACT_FIELDS: readonly ContactField[] = ['name', 'email', 'message']

/** Longest address a DNS name can carry (RFC 5321 4.5.3.1.3), in characters. */
const MAX_EMAIL = 254

/** Empty, or nothing but whitespace. `trim()` covers the ideographic and no-break spaces too. */
const blank = (value: string) => value.trim() === ''

/**
 * Domain: one or more labels, then a final label of two or more characters. Two *characters*
 * rather than two ASCII letters, or an IDN domain (`例子.中国`) would be rejected for being
 * foreign rather than for being wrong.
 */
const DOMAIN = /^[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/

/**
 * Local part: no whitespace, `,` or `;`. The last two are list separators in every mail
 * client, so an address containing one is a paste accident rather than an address.
 */
const LOCAL = /^[^\s@,;]+$/

/** `undefined` when the address is usable, otherwise the code for why it is not. */
const emailError = (raw: string): ContactError | undefined => {
  const value = raw.trim()
  if (blank(value)) return 'required'
  if (value.length > MAX_EMAIL) return 'emailUnusable'

  const at = value.indexOf('@')
  /* No `@` at all, or one with nothing on a side of it. */
  if (at <= 0 || at === value.length - 1) return 'emailMissingAt'
  /* A second `@`: not a missing one, just not an address. */
  if (value.indexOf('@', at + 1) !== -1) return 'emailUnusable'

  if (!LOCAL.test(value.slice(0, at))) return 'emailUnusable'
  if (!DOMAIN.test(value.slice(at + 1))) return 'emailIncompleteDomain'
  return undefined
}

/**
 * One field, checked on its own - which is what blur and input need, with no whole form to
 * look at. Unknown names have no rules and never fail, so a caller can report every field
 * and let this decide which ones matter.
 */
export function validateField(field: string, value: string): ContactError | undefined {
  if (field === 'email') return emailError(value)
  if (field === 'name' || field === 'message') return blank(value) ? 'required' : undefined
  return undefined
}

/** Every rule at once, for a submit. */
export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {}
  for (const field of CONTACT_FIELDS) {
    const error = validateField(field, values[field])
    if (error) errors[field] = error
  }
  return errors
}

/** Narrowing guard for a DOM `name`, most of which are not validated fields. */
export const isContactField = (name: string): name is ContactField =>
  CONTACT_FIELDS.some((field) => field === name)
