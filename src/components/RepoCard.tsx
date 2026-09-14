import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, CircleDot, GitFork, Scale, Star } from 'lucide-react'

import Glyph from '@/components/Glyph'
import MarkdownBody from '@/components/MarkdownBody'
import type { ProjectGlyph } from '@/data/projects'
import { site } from '@/data/site'
import type { Repo } from '@/lib/github'
import { useLocale } from '@/lib/locale'
import { languageColours, useReadme } from '@/lib/github'
import { EASE_AK } from '@/lib/motion'
import { cn, formatDate } from '@/lib/utils'

/**
 * Repository card. Everything comes from GitHub - name, blurb, language, metrics, topics -
 * including the presentation, which arrives as topics resolved by `src/data/projects.ts`.
 * There is no per-repository configuration in the codebase.
 *
 * The glyph is a prop because the default choice is a property of the whole set (see
 * `curate`), and the README is fetched on first expand rather than up front: a dozen repos
 * would be a dozen requests for content most visitors never open.
 */
/*
 * Card sizing: `h-full` is deliberately absent. Grid items stretch to their row by default,
 * so with an expandable README, opening one card dragged its whole row past 1000px and every
 * sibling became an empty bordered box. Instead cards size to their content, and the two
 * regions that vary are normalised - the blurb is clamped to two lines and the topic row
 * reserves its height.
 */
export default function RepoCard({
  repo,
  glyph,
  position,
}: {
  repo: Repo
  glyph: ProjectGlyph
  position: number
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const panelId = useId()

  // Card text is the repository description; rewording it is a GitHub settings change.
  const blurb = repo.description ?? t.projects.noDescription

  const { markdown, loading } = useReadme(site.github, repo.name, repo.defaultBranch, open)

  return (
    <article className="ak-panel ak-corners group relative flex flex-col transition-colors duration-ak hover:border-ak-accent/40">
      {/* Header: counter and status */}
      <div className="flex items-center justify-between border-b border-ak-border px-4 py-2.5">
        <span className="ak-index">{String(position).padStart(2, '0')}</span>
        <span
          className={cn(
            'border px-1.5 py-0.5 font-mono text-[0.5625rem] tracking-ak',
            repo.archived ? 'border-ak-border text-ak-muted' : 'border-ak-accent/50 text-ak-accent',
          )}
        >
          {repo.archived ? t.projects.archived : t.projects.active}
        </span>
      </div>

      {/* Illustration. `overflow-clip`, not `overflow-hidden`: the grid layer below is a
          full-bleed absolute box with no `pointer-events: none`, so with `hidden` this
          box was a scroll container and a touch that landed on the artwork belonged to
          it rather than to the page. Same clipping, no scroll container. */}
      <div className="relative flex h-28 items-center justify-center overflow-clip border-b border-ak-border bg-ak-bg/60">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgb(var(--ak-border)) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--ak-border)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <Glyph
          glyph={glyph}
          className="relative h-14 w-14 text-ak-muted transition-all duration-300 ease-ak group-hover:scale-105 group-hover:text-ak-accent"
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0">
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block truncate text-base font-bold text-ak-text transition-colors duration-ak hover:text-ak-accent"
            >
              {repo.name}
            </a>
          </h3>

          {repo.language && (
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-2xs text-ak-muted">
              <CircleDot
                size={10}
                strokeWidth={3}
                style={{ color: languageColours[repo.language] ?? 'rgb(var(--ak-accent))' }}
                aria-hidden
              />
              {repo.language}
            </span>
          )}
        </div>

        {/* Exactly two lines of height, always. `min-height` was not enough - a one-line
            blurb sat at the minimum while a two-line one took its natural height. `em` so
            the value tracks the font size; `line-clamp-2` stops a long blurb overrunning. */}
        <p className="ak-text-pretty mt-2 line-clamp-2 h-[3.25em] text-xs leading-relaxed text-ak-muted">
          {blurb}
        </p>

        {/* All topics, over two reserved lines - see `.ak-chip-row` for why the height is
            fixed rather than derived. Nothing in this set comes close to the clip. */}
        <ul className="ak-chip-row mt-3 h-[3.75rem] gap-1.5">
          {repo.topics.map((topic) => (
            <li key={topic} className="ak-chip">
              {topic}
            </li>
          ))}
        </ul>

        {/* `min-h` matches one line of mono text, so a card without a license is not
            shorter than its neighbours. */}
        <div className="mt-4 flex min-h-[1.15rem] flex-wrap items-center gap-x-4 gap-y-2 font-mono text-2xs text-ak-muted">
          <span className="flex items-center gap-1">
            <Star size={11} aria-hidden />
            {repo.stars}
          </span>
          <span className="flex items-center gap-1">
            <GitFork size={11} aria-hidden />
            {repo.forks}
          </span>
          {repo.license && (
            <span className="flex items-center gap-1">
              <Scale size={11} aria-hidden />
              {repo.license}
            </span>
          )}
          <span className="ml-auto">{formatDate(repo.pushedAt)}</span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 border-t border-ak-border pt-3.5">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="ak-btn ak-notch-sm flex-1 justify-between !py-2 !text-[0.6875rem]"
          >
            {open ? t.projects.hideReadme : t.projects.showReadme}
            <ChevronDown
              size={13}
              aria-hidden
              className={cn('transition-transform duration-ak', open && 'rotate-180')}
            />
          </button>

          <a
            href={repo.url}
            target="_blank"
            rel="noreferrer noopener"
            className="ak-btn ak-notch-sm !py-2 !text-[0.6875rem]"
          >
            {t.projects.code}
          </a>
        </div>
      </div>

      {/* README panel. Height animates from 0 so the card grows in place rather than the
          list jumping. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="readme"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_AK }}
            className="overflow-clip border-t border-ak-border"
          >
            {/* Fixed height, not max-height: with a ceiling, an expanded card's height
                depended on that README's length, so the layout shifted differently every
                time. Long READMEs scroll inside and the row height never changes.
                (Note the braces - a bare comment in JSX children renders as text.) */}
            <div className="ak-readme-scroll bg-ak-bg/40 px-4 py-4">
              {loading && (
                <p className="font-mono text-2xs tracking-ak text-ak-muted">
                  {t.projects.readmeLoading}
                </p>
              )}

              {!loading && !markdown && (
                <p className="font-mono text-2xs tracking-ak text-ak-muted">
                  {t.projects.readmeMissing}
                </p>
              )}

              {markdown && (
                /* Prose tokens are scaled down for a third-width card. Relative links are
                   rendered inert - the CODE button is the honest route to the README. */
                <div className="ak-readme-prose">
                  <MarkdownBody content={markdown} allowHtml disableRelativeLinks />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}
