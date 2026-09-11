import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'

import EmailLink from '@/components/EmailLink'
import { PageHeader, PageShell } from '@/components/Primitives'
import StatsPanel from '@/components/StatsPanel'
import { site } from '@/data/site'
import { useLocale } from '@/lib/locale'
import { fadeUp } from '@/lib/motion'
import { useSeo } from '@/lib/seo'

/**
 * Two halves: a short hand-written introduction, and a statistics block that is fetched, so
 * everything factual about the work stays current. The percentage skill bars, the timeline
 * and the language-specific framing were all removed - they restated what the project list
 * already shows.
 */
export default function AboutPage() {
  const { t } = useLocale()
  useSeo({
    title: t.pages.about,
    path: '/about',
    description: t.meta.about,
  })

  return (
    <PageShell>
      <PageHeader index="02" title={t.pages.about} subtitle={t.about.subtitle} />

      <div className="ak-container grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        {/* Introduction */}
        <div>
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <span className="ak-label">{t.about.selfIntro}</span>
            <span className="h-px flex-1 bg-ak-border" />
          </motion.div>

          <div className="mt-5 space-y-4">
            {t.content.bio.map((paragraph) => (
              <motion.p
                key={paragraph.slice(0, 16)}
                variants={fadeUp}
                className="ak-text-pretty ak-cjk text-sm leading-relaxed text-ak-muted md:text-[0.9375rem]"
              >
                {paragraph}
              </motion.p>
            ))}
          </div>

          {/* Facts, kept minimal and non-redundant */}
          <motion.dl variants={fadeUp} className="mt-8 space-y-px bg-ak-border">
            <Fact label={t.about.factLocation} value={t.content.location} icon />
            <Fact
              label={t.socials.github}
              value={`@${site.github}`}
              href={`https://github.com/${site.github}`}
            />
            <Fact label={t.about.factEmail} value={<EmailLink />} />
          </motion.dl>
        </div>

        {/* Live statistics */}
        <StatsPanel />
      </div>
    </PageShell>
  )
}

function Fact({
  label,
  value,
  href,
  icon = false,
}: {
  label: string
  /** A string is rendered as text; a node is rendered as-is. */
  value: React.ReactNode
  href?: string
  icon?: boolean
}) {
  const content = (
    <>
      <span className="ak-label">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-xs text-ak-text">
        {icon && <MapPin size={11} className="shrink-0 text-ak-accent-2" aria-hidden />}
        {value}
      </span>
    </>
  )

  return (
    <div className="bg-ak-surface">
      {href ? (
        <a
          href={href}
          {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-ak hover:bg-ak-surface-2"
        >
          {content}
        </a>
      ) : (
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">{content}</div>
      )}
    </div>
  )
}
