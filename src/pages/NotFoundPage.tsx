import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import { site } from '@/data/site'
import { ARROW_NE } from '@/lib/glyphs'
import { useLocale } from '@/lib/locale'
import { fadeUp, pageStagger } from '@/lib/motion'
import { useSeo } from '@/lib/seo'

const suggestions = [
  { key: 'home', to: '/', index: '00' },
  { key: 'projects', to: '/projects', index: '01' },
  { key: 'blog', to: '/blog', index: '03' },
] as const

export default function NotFoundPage() {
  const { t } = useLocale()
  useSeo({ title: '404', path: '/404', description: t.meta.notFound })

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={pageStagger}
      className="ak-container flex min-h-[70vh] flex-col justify-center py-20"
    >
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <span className="h-1.5 w-1.5 bg-ak-danger" />
        <span className="ak-label">{t.notFound.label}</span>
      </motion.div>

      <motion.h1
        variants={fadeUp}
        className="mt-6 font-mono text-[clamp(4rem,16vw,10rem)] font-bold leading-[0.85] text-ak-text"
      >
        404
        <span className="ml-3 inline-block h-[0.12em] w-[0.4em] animate-blink bg-ak-danger align-baseline" />
      </motion.h1>

      <motion.p variants={fadeUp} className="mt-6 max-w-lg text-sm leading-relaxed text-ak-muted">
        {t.notFound.body}
      </motion.p>

      <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="ak-btn ak-btn--solid ak-notch-sm">
          {t.notFound.home}
        </Link>
        <a
          href={`https://github.com/${site.github}`}
          target="_blank"
          rel="noreferrer noopener"
          className="ak-btn ak-notch-sm"
        >
          {t.socials.github} {ARROW_NE}
        </a>
      </motion.div>

      <motion.div variants={fadeUp} className="mt-14 border-t border-ak-border pt-6">
        <p className="ak-label">{t.notFound.suggestions}</p>
        <ul className="mt-4 flex flex-wrap gap-px bg-ak-border">
          {suggestions.map((item) => (
            <li key={item.to} className="bg-ak-surface">
              <Link
                to={item.to}
                className="flex items-baseline gap-2 px-4 py-3 transition-colors duration-ak hover:bg-ak-surface-2"
              >
                <span className="ak-index">{item.index}</span>
                <span className="text-sm text-ak-text">{t.pages[item.key]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.section>
  )
}
