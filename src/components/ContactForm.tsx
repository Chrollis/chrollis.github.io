import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2, Send, TriangleAlert } from 'lucide-react'

import AuthSlider from '@/components/AuthSlider'
import { isBlank, site, fullEmail } from '@/data/site'
import { useLocale } from '@/lib/locale'
import { fadeUp } from '@/lib/motion'
import { isContactField, validateContact, validateField } from '@/lib/validate'
import type { ContactError, ContactErrors } from '@/lib/validate'

type Status = 'idle' | 'sending' | 'ok' | 'error'

/**
 * Contact form. A static host has no backend, so submissions go through a hosted forwarder:
 * `web3forms` (access key, which can live in a repository secret) or `formsubmit` (the
 * default - no account, brings its own reCAPTCHA, plus the `_honey` honeypot below).
 *
 * With neither configured the component renders nothing: a form that silently drops messages
 * is worse than no form. There is no Turnstile and there cannot be - Cloudflare requires
 * server-side validation with the secret key. See `docs/CONVENTIONS.md`.
 *
 * Validation is ours, not the browser's: `<form noValidate>` with rules in `lib/validate` and
 * error text from the locale. The native attributes stay - `required` is what a screen reader
 * announces and `type="email"` is what picks the keyboard - but the browser's own bubble is
 * system-font, English-only and unstylable, and it blocks `onSubmit` outright, so it could
 * never explain itself in this page's voice. Field-level readouts sit under each field; the
 * status line at the bottom stays the form's own line (sending / sent / failed / summary).
 */
export default function ContactForm() {
  const { t } = useLocale()
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<ContactErrors>({})
  /** The authorization beat: the slider's outcome, and how many times it has been asked for. */
  const [authorized, setAuthorized] = useState(false)
  const [nudge, setNudge] = useState(0)
  /** Successful sends, used as the slider's key so a new message needs a new authorization. */
  const [sends, setSends] = useState(0)

  const { provider, web3formsKey } = site.contactForm

  if (provider === 'none') return null
  if (provider === 'web3forms' && isBlank(web3formsKey)) return null

  const endpoint =
    provider === 'web3forms'
      ? 'https://api.web3forms.com/submit'
      : `https://formsubmit.co/ajax/${fullEmail()}`

  /*
   * Codes come from `lib/validate`, words come from the locale, and this record is the one
   * place that joins them. A record rather than `t.contact[code]`: the string audit scans for
   * literal `t.a.b` paths, so a computed lookup would make every one of these keys look dead.
   */
  const errorText: Record<ContactError, string> = {
    required: t.contact.required,
    emailMissingAt: t.contact.emailMissingAt,
    emailIncompleteDomain: t.contact.emailIncompleteDomain,
    emailUnusable: t.contact.emailUnusable,
  }

  /*
   * Per-field checking, with the timing that decides whether a form reads as helpful or
   * hostile: blur reports, input only re-checks a field that is already showing an error (so a
   * mistake clears the moment it is fixed) and never raises a new one while someone is still
   * typing their first character. Fields nobody has touched stay silent until submit.
   */
  const check = (name: string, value: string, phase: 'blur' | 'input') => {
    /* `subject_custom` has no rules - `validate` decides which names have them. */
    if (!isContactField(name)) return
    setErrors((current) => {
      if (phase === 'input' && current[name] === undefined) return current
      const error = validateField(name, value)
      if (error === current[name]) return current
      const next = { ...current }
      if (error) next[name] = error
      else delete next[name]
      return next
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget

    tidy(form)

    const data = new FormData(form)
    const found = validateContact({
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      message: String(data.get('message') ?? ''),
    })

    if (Object.keys(found).length > 0) {
      setErrors(found)
      setStatus('error')
      /* Focus the first field in reading order that needs attention - `focus()` scrolls it
         into view by itself, so there is nothing to scroll by hand. Not a summary the visitor
         has to map back onto the form. */
      for (const field of ['name', 'email', 'message'] as const) {
        if (!found[field]) continue
        const control = form.elements.namedItem(field)
        if (control instanceof HTMLElement) control.focus()
        break
      }
      return
    }

    /* Fields first, authorization second: a message that is missing a name is the visitor's
       own problem to fix, and the slider is the last step before sending rather than a gate in
       front of the form. The button is never disabled - pressing it is how you find out. */
    if (!authorized) {
      setNudge((count) => count + 1)
      return
    }

    setErrors({})
    setStatus('sending')
    setMessage('')

    if (provider === 'web3forms') data.append('access_key', web3formsKey)
    data.append('subject', `Message from ${site.url}`)
    data.append('from_name', site.name)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
      })
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean
        message?: string
      }

      if (!response.ok || result.success === false) {
        throw new Error(result.message ?? `HTTP ${response.status}`)
      }

      setStatus('ok')
      setMessage(t.contact.sent)
      form.reset()
      /* A new authorization per message: the one just given authorized this message, not the
         next. Clearing `nudge` too, or the remounted slider would demand authorization and
         take focus the instant the visitor had finished sending. */
      setAuthorized(false)
      setNudge(0)
      setSends((count) => count + 1)
    } catch (error) {
      setStatus('error')
      /* The provider's message is for the console; the visitor gets the two plain strings.
         The raw text was a network or HTTP string in English and read as noise. */
      console.error('[contact] submit failed:', error)
      setMessage(`${t.contact.sendFailed}. ${t.contact.sendFailedHint}`)
    }
  }

  const label =
    provider === 'web3forms' ? t.contact.formProviderWeb3 : t.contact.formProviderFormSubmit

  /* Derived, not stored: the summary cannot go stale, and it clears itself the moment the last
     field is fixed rather than on the next submit. */
  const pending = Object.keys(errors).length
  /* An unauthorized submit outranks the privacy note but not an unfinished field: the field is
     something to fix, this is something to do. */
  const needsAuth = nudge > 0 && !authorized

  return (
    <motion.form
      variants={fadeUp}
      onSubmit={handleSubmit}
      noValidate
      className="ak-panel p-5 md:p-6"
    >
      <div className="flex items-center justify-between border-b border-ak-border pb-3">
        <span className="ak-label">{t.contact.message}</span>
        <span className="ak-index">{label}</span>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t.contact.name}
            name="name"
            placeholder={t.contact.namePlaceholder}
            autoComplete="name"
            maxLength={80}
            required
            error={errors.name && errorText[errors.name]}
            onCheck={check}
          />
          <Field
            label={t.contact.email}
            name="email"
            type="email"
            placeholder={t.contact.emailPlaceholder}
            autoComplete="email"
            /* The DNS ceiling the rules check too, so the attribute and the rule agree. */
            maxLength={254}
            required
            error={errors.email && errorText[errors.email]}
            onCheck={check}
          />
        </div>
        <Field
          label={t.contact.subject}
          name="subject_custom"
          placeholder={t.contact.subjectPlaceholder}
          maxLength={120}
          note={t.contact.optional}
          onCheck={check}
        />

        <Field
          label={t.contact.message}
          name="message"
          placeholder={t.contact.messagePlaceholder}
          multiline
          maxLength={5000}
          required
          error={errors.message && errorText[errors.message]}
          onCheck={check}
        />

        {/* Honeypot: bots fill it, humans never see it.
            `sr-only` rather than Tailwind's `hidden`. `hidden` is
            `display: none`, which a scraper can read out of the CSS and skip -
            the field has to look like an ordinary one in the DOM to catch
            anything. `sr-only` keeps it in the layout at 1px and clipped, which
            is invisible to a person but present to a parser. `aria-hidden` takes
            it back out of the accessibility tree, since `sr-only` alone would
            still have a screen reader announce it. */}
        <input
          type="text"
          name="_honey"
          className="sr-only"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
      </div>

      <AuthSlider
        key={sends}
        authorized={authorized}
        onAuthorize={() => setAuthorized(true)}
        nudge={nudge}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ak-border pt-4">
        <button
          type="submit"
          /* Disabled only while a send is in flight. A form that disables its button while it
             is invalid cannot be pressed to find out why, and a disabled button cannot be
             focused either. */
          disabled={status === 'sending'}
          className="ak-btn ak-btn--solid ak-notch-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending' ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t.contact.sending}
            </>
          ) : (
            <>
              <Send size={14} />
              {t.contact.send}
            </>
          )}
        </button>

        <p
          role="status"
          aria-live="polite"
          className={`flex items-center gap-1.5 font-mono text-2xs tracking-ak ${
            pending > 0 || needsAuth || status === 'error'
              ? 'text-ak-danger'
              : status === 'ok'
                ? 'text-ak-accent-2'
                : 'text-ak-muted'
          }`}
        >
          {status === 'ok' && <Check size={12} aria-hidden />}
          {(pending > 0 || needsAuth || status === 'error') && (
            <TriangleAlert size={12} aria-hidden />
          )}
          {pending > 0
            ? t.contact.formIncomplete
            : needsAuth
              ? t.contact.authRequired
              : message || t.contact.privacy}
        </p>
      </div>
    </motion.form>
  )
}

/**
 * Trim every field's ends, in place, once, at submit. Autofill and paste leave ends that are
 * invisible on screen and travel to the forwarder, where a trailing space in a reply address
 * is a silent failure. Written back rather than reported, so the visitor sees the cleaned
 * value instead of being told about it.
 */
function tidy(form: HTMLFormElement) {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) continue
    const trimmed = element.value.trim()
    if (element.value !== trimmed) element.value = trimmed
  }
}

type FieldProps = {
  label: string
  name: string
  type?: string
  placeholder?: string
  autoComplete?: string
  /** Ceilings only, never floors: a one-word message is a message. */
  maxLength?: number
  required?: boolean
  multiline?: boolean
  /** Micro-type annotation on the label's own line, e.g. `OPTIONAL`. */
  note?: string
  /** The readout to show under the field, already translated. */
  error?: string
  onCheck: (name: string, value: string, phase: 'blur' | 'input') => void
}

/**
 * One field. The label wraps the control, so the label text is the accessible name without an
 * `id`/`htmlFor` pair; the error gets an id of its own and is pointed at by `aria-describedby`,
 * which is what makes it read out on focus rather than only appearing on screen. No
 * `role="alert"`: three fields failing at once would announce three times.
 */
function Field({
  label,
  name,
  type = 'text',
  placeholder,
  autoComplete,
  maxLength,
  required,
  multiline,
  note,
  error,
  onCheck,
}: FieldProps) {
  const errorId = useId()
  const shared = {
    name,
    required,
    placeholder,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onCheck(name, event.currentTarget.value, 'blur'),
    onInput: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onCheck(name, event.currentTarget.value, 'input'),
  }

  return (
    <label className="block">
      {/* Label and note on one line, the note pushed to the far edge - the same readout shape
          as this form's own header row. Both sit inside the `<label>`, so the accessible name
          is "SUBJECT OPTIONAL": the exception is worth announcing. */}
      <span className="flex items-baseline justify-between gap-3">
        <span className="ak-label">{label}</span>
        {note && <span className="ak-label text-ak-muted/60">{note}</span>}
      </span>

      {multiline ? (
        <textarea {...shared} rows={6} className="ak-field mt-2 resize-y" />
      ) : (
        <input {...shared} type={type} autoComplete={autoComplete} className="ak-field mt-2" />
      )}

      {/* `ak-label` for the readout and `text-ak-danger` to recolour it: utilities come after
          the components layer, so the colour wins without `!important`. */}
      {error && (
        <p id={errorId} className="ak-label mt-1.5 text-ak-danger">
          {error}
        </p>
      )}
    </label>
  )
}
