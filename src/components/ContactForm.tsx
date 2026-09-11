import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2, Send, TriangleAlert } from 'lucide-react'

import { isBlank, site, fullEmail } from '@/data/site'
import { useLocale } from '@/lib/locale'
import { fadeUp } from '@/lib/motion'

type Status = 'idle' | 'sending' | 'ok' | 'error'

/**
 * Contact form. A static host has no backend, so submissions go through a hosted forwarder:
 * `web3forms` (access key, which can live in a repository secret) or `formsubmit` (the
 * default - no account, brings its own reCAPTCHA, plus the `_honey` honeypot below).
 *
 * With neither configured the component renders nothing: a form that silently drops messages
 * is worse than no form. There is no Turnstile and there cannot be - Cloudflare requires
 * server-side validation with the secret key. See `docs/CONVENTIONS.md`.
 */
export default function ContactForm() {
  const { t } = useLocale()
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const { provider, web3formsKey } = site.contactForm

  if (provider === 'none') return null
  if (provider === 'web3forms' && isBlank(web3formsKey)) return null

  const endpoint =
    provider === 'web3forms'
      ? 'https://api.web3forms.com/submit'
      : `https://formsubmit.co/ajax/${fullEmail()}`

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

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

  return (
    <motion.form variants={fadeUp} onSubmit={handleSubmit} className="ak-panel p-5 md:p-6">
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
            required
          />
          <Field
            label={t.contact.email}
            name="email"
            type="email"
            placeholder={t.contact.emailPlaceholder}
            required
          />
        </div>
        <Field
          label={t.contact.subject}
          name="subject_custom"
          placeholder={t.contact.subjectPlaceholder}
        />

        <label className="block">
          <span className="ak-label">{t.contact.message}</span>
          <textarea
            name="message"
            required
            rows={6}
            placeholder={t.contact.messagePlaceholder}
            className="ak-field mt-2 resize-y"
          />
        </label>

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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ak-border pt-4">
        <button
          type="submit"
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
            status === 'ok'
              ? 'text-ak-accent-2'
              : status === 'error'
                ? 'text-ak-danger'
                : 'text-ak-muted'
          }`}
        >
          {status === 'ok' && <Check size={12} aria-hidden />}
          {status === 'error' && <TriangleAlert size={12} aria-hidden />}
          {message || t.contact.privacy}
        </p>
      </div>
    </motion.form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="ak-label">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="ak-field mt-2"
      />
    </label>
  )
}
