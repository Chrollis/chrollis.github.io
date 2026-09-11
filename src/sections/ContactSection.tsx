import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import ContactForm from '@/components/ContactForm'
import EmailLink from '@/components/EmailLink'
import SocialLinks from '@/components/SocialLinks'
import { site } from '@/data/site'
import { ARROW_NE } from '@/lib/glyphs'
import { useLocale } from '@/lib/locale'
import { fadeUp } from '@/lib/motion'
import { assetUrl } from '@/lib/assets'

/**
 * One list of destinations, not two: the old channel table repeated GitHub and email from
 * the social row beneath it. The feed is the one thing genuinely different from a social
 * account, so it is a footnote.
 *
 * No section heading - the page header above already names this page, and a second one
 * repeated its index and eyebrow. It also carries no vertical padding: `PageShell` and
 * `PageHeader` already space the page, and adding more here opened a gap no other route had.
 */
export default function ContactSection() {
  const { t } = useLocale()
  return (
    <section id="contact" className="ak-container">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
        <motion.div variants={fadeUp}>
          <p className="ak-text-pretty ak-cjk text-sm leading-relaxed text-ak-muted md:text-[0.9375rem]">
            {t.contact.intro}
          </p>

          <div className="mt-7 flex items-center gap-3">
            <span className="ak-label">{t.contact.social}</span>
            <span className="h-px flex-1 bg-ak-border" />
          </div>

          {/* The single list of places to find me. */}
          <div className="mt-4">
            <SocialLinks variant="full" orientation="column" />
          </div>

          <p className="mt-6 font-mono text-2xs leading-relaxed tracking-ak text-ak-muted">
            {t.contact.feedNote}{' '}
            <a href={assetUrl('feeds/rss.xml')} className="text-ak-accent hover:underline">
              {t.files.rss}
            </a>
          </p>
        </motion.div>

        <div>
          <ContactForm />

          {/* With no forwarding service configured the form renders nothing, so
              show what to do instead of leaving an empty column. */}
          {site.contactForm.provider === 'none' && (
            <motion.div variants={fadeUp} className="ak-panel p-5 md:p-6">
              <div className="flex items-center justify-between border-b border-ak-border pb-3">
                <span className="ak-label">{t.contact.message}</span>
                <span className="ak-index">{t.contact.notConfigured}</span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-ak-muted">
                {t.contact.notConfiguredHelp}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <EmailLink className="ak-btn ak-btn--solid ak-notch-sm">
                  {t.contact.emailMe} {ARROW_NE}
                </EmailLink>
                <Link to="/about" className="ak-btn ak-notch-sm">
                  {t.contact.learnAboutMe}
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
