import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CircleDot } from 'lucide-react'

import { PageHeader, PageShell } from '@/components/Primitives'
import RepoCard from '@/components/RepoCard'
import { curate, pagesRepoFor } from '@/data/projects'
import { site } from '@/data/site'
import { dataFetchedAt, repos as allRepos } from '@/lib/github'
import { useLocale } from '@/lib/locale'
import { fadeUp } from '@/lib/motion'
import { useSeo } from '@/lib/seo'
import { cn, formatDate } from '@/lib/utils'

/**
 * Data comes from the build, so there is no loading or failure state - the list is simply
 * present. Language filters are derived from the languages actually present, so tagging a
 * new repo changes the filter row by itself. Ordering and hiding are `curate`'s job.
 */
export default function ProjectsPage() {
  const { t } = useLocale()
  useSeo({ title: t.pages.projects, path: '/projects', description: t.meta.projects })

  const [filter, setFilter] = useState<string | null>(null)

  /* Resolved once for the whole set, because the default illustration is assigned globally
     - see `curate`. `selfRepo` keeps the site's own repository off the list. */
  const curated = useMemo(() => curate(allRepos, { selfRepo: pagesRepoFor(site.github) }), [])

  const visible = useMemo(() => curated.filter((entry) => !entry.hidden), [curated])

  const ordered = useMemo(
    () =>
      [...visible].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1
        return b.repo.pushedAt.localeCompare(a.repo.pushedAt)
      }),
    [visible],
  )

  /** Language filters, most common first, derived from the live data. */
  const languages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of visible) {
      const language = entry.repo.language
      if (!language) continue
      counts.set(language, (counts.get(language) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
  }, [visible])

  const list = useMemo(
    () => (filter ? ordered.filter((entry) => entry.repo.language === filter) : ordered),
    [ordered, filter],
  )

  const totals = useMemo(() => {
    const stars = visible.reduce((sum, entry) => sum + entry.repo.stars, 0)
    const forks = visible.reduce((sum, entry) => sum + entry.repo.forks, 0)
    return { repos: visible.length, stars, forks, languages: languages.length }
  }, [visible, languages])

  return (
    <PageShell>
      <PageHeader
        index="01"
        title={t.pages.projects}
        subtitle={t.projects.subtitle}
        description={t.projects.intro}
      />

      <div className="ak-container">
        {/* Summary, computed from the same response the cards use */}
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-2 gap-px bg-ak-border sm:grid-cols-4"
        >
          {[
            { label: t.projects.total, value: String(totals.repos) },
            { label: t.projects.languages, value: String(totals.languages) },
            { label: t.projects.stars, value: String(totals.stars) },
            { label: t.projects.forks, value: String(totals.forks) },
          ].map((stat) => (
            <div key={stat.label} className="bg-ak-surface px-4 py-4">
              <p className="ak-label text-[0.5625rem]">{stat.label}</p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-ak-text">{stat.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Snapshot date rather than a live/stale indicator.
            The data is baked in at build time, so there is no loading or failure
            state to report - but the numbers can be a day old, and showing when
            they were captured is more honest than implying they are live. */}
        <motion.div variants={fadeUp} className="mt-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 bg-ak-accent-2" />
          <span className="ak-index">
            {t.projects.snapshot} {formatDate(dataFetchedAt)}
          </span>
        </motion.div>

        {/* Language filter, built from what is actually there */}
        {languages.length > 0 && (
          <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center gap-2">
            <span className="ak-label mr-1">{t.projects.filter}</span>

            <FilterChip active={filter === null} onClick={() => setFilter(null)}>
              {t.common.all} ({visible.length})
            </FilterChip>

            {languages.map((language) => (
              <FilterChip
                key={language.name}
                active={filter === language.name}
                onClick={() => setFilter(language.name === filter ? null : language.name)}
              >
                <CircleDot size={9} strokeWidth={3} className="shrink-0" aria-hidden />
                {language.name} ({language.count})
              </FilterChip>
            ))}

            <span className="ml-auto ak-index">
              {list.length} {t.projects.items}
            </span>
          </motion.div>
        )}

        {list.length === 0 ? (
          <p className="mt-12 border border-dashed border-ak-border px-6 py-12 text-center font-mono text-xs tracking-ak text-ak-muted">
            {t.projects.empty}
          </p>
        ) : (
          <motion.div
            variants={fadeUp}
            /* `items-start` so the grid never stretches a card to fill a row; cards size to
               their own content. See the sizing note in RepoCard. */
            className="mt-6 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
          >
            {list.map((entry, index) => (
              <RepoCard
                key={entry.repo.name}
                repo={entry.repo}
                glyph={entry.glyph}
                position={index + 1}
              />
            ))}
          </motion.div>
        )}

        <motion.p
          variants={fadeUp}
          className="mt-10 border-t border-ak-border pt-6 font-mono text-2xs tracking-ak text-ak-muted"
        >
          {t.projects.moreOnGithub}{' '}
          <a
            href={`https://github.com/${site.github}?tab=repositories`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ak-accent hover:underline"
          >
            {t.socials.github.toUpperCase()}
          </a>
        </motion.p>
      </div>
    </PageShell>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 border px-3 py-1.5 font-mono text-2xs tracking-ak transition-colors duration-ak',
        active
          ? 'border-ak-accent bg-ak-accent text-ak-bg'
          : 'border-ak-border text-ak-muted hover:border-ak-accent/60 hover:text-ak-accent',
      )}
    >
      {children}
    </button>
  )
}
