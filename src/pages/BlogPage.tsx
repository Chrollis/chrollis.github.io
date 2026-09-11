import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/Primitives'
import { useLocale } from '@/lib/locale'
import { fadeUp } from '@/lib/motion'
import { getAllTags, postMetas } from '@/lib/posts'
import { useSeo } from '@/lib/seo'
import { cn, formatRelative } from '@/lib/utils'

export default function BlogPage() {
  const { t } = useLocale()
  useSeo({
    title: t.pages.blog,
    path: '/blog',
    description: t.meta.blog.replace('{count}', String(postMetas.length)),
  })

  const tags = useMemo(() => getAllTags(), [])
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const list = useMemo(
    () => (activeTag ? postMetas.filter((post) => post.tags.includes(activeTag)) : postMetas),
    [activeTag],
  )

  return (
    <PageShell>
      <PageHeader
        index="03"
        title={t.pages.blog}
        subtitle={t.blog.subtitle}
        description={t.blog.intro}
      />

      <div className="ak-container">
        {tags.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8 flex flex-wrap items-center gap-2">
            <span className="ak-label mr-1">{t.blog.tags}</span>
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              aria-pressed={activeTag === null}
              className={cn(
                'border px-2.5 py-1 font-mono text-2xs tracking-ak transition-colors duration-ak',
                activeTag === null
                  ? 'border-ak-accent bg-ak-accent text-ak-bg'
                  : 'border-ak-border text-ak-muted hover:border-ak-accent/60 hover:text-ak-accent',
              )}
            >
              {t.common.all} ({postMetas.length})
            </button>
            {tags.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => setActiveTag(item.tag === activeTag ? null : item.tag)}
                aria-pressed={activeTag === item.tag}
                className={cn(
                  'border px-2.5 py-1 font-mono text-2xs tracking-ak transition-colors duration-ak',
                  activeTag === item.tag
                    ? 'border-ak-accent bg-ak-accent text-ak-bg'
                    : 'border-ak-border text-ak-muted hover:border-ak-accent/60 hover:text-ak-accent',
                )}
              >
                {item.tag} ({item.count})
              </button>
            ))}
          </motion.div>
        )}

        {list.length === 0 ? (
          <motion.div
            variants={fadeUp}
            className="border border-dashed border-ak-border px-6 py-16 text-center"
          >
            <p className="font-mono text-xs tracking-ak text-ak-muted">{t.blog.empty}</p>
            <p className="mt-3 text-xs text-ak-muted/70">{t.blog.emptyHint}</p>
          </motion.div>
        ) : (
          <motion.ul
            variants={fadeUp}
            className="divide-y divide-ak-border border-y border-ak-border"
          >
            {list.map((post) => (
              <li key={post.slug}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="group flex flex-col gap-3 px-4 py-5 transition-colors duration-ak hover:bg-ak-surface/50 md:flex-row md:items-start md:gap-6 md:px-5"
                >
                  <span className="ak-index shrink-0 pt-1">{post.code}</span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-base font-bold text-ak-text transition-colors duration-ak group-hover:text-ak-accent">
                        {post.title}
                      </span>
                      <span className="border border-ak-border px-1.5 py-px font-mono text-[0.5625rem] tracking-ak text-ak-muted">
                        {post.category}
                      </span>
                    </span>

                    <span className="ak-text-pretty mt-2 block text-xs leading-relaxed text-ak-muted md:text-sm">
                      {post.description}
                    </span>

                    {post.tags.length > 0 && (
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <span key={tag} className="ak-chip">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>

                  {/*
                   * Recency rather than a date, so the listing reads as a feed - the
                   * unit scales with the age, so every entry is a small number in the
                   * unit that suits it. See `formatRelative`.
                   */}
                  <span className="flex shrink-0 items-center gap-3 font-mono text-2xs text-ak-muted md:flex-col md:items-end md:gap-1.5 md:pt-1">
                    <span>{formatRelative(post.date)}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} aria-hidden />
                      {post.readingMinutes} {t.common.minRead}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </div>
    </PageShell>
  )
}
