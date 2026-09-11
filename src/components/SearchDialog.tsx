import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CornerDownLeft, Search as SearchIcon, X } from 'lucide-react'

import { QUOTE_CLOSE, QUOTE_OPEN } from '@/lib/glyphs'
import { useLocale } from '@/lib/locale'
import { EASE_AK } from '@/lib/motion'
import { postMetas } from '@/lib/posts'
import { searchPosts } from '@/lib/search'
import type { SearchHit } from '@/lib/search'
import { formatDate } from '@/lib/utils'

/**
 * Two components on purpose: the outer owns the open/close animation, the inner owns query
 * and selection state and exists only while the dialog is open - so "clear the query on
 * close" falls out of unmounting rather than an effect that syncs state.
 */
export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-overlay flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          role="dialog"
          aria-modal="true"
          aria-label={t.search.title}
        >
          <button
            type="button"
            className="absolute inset-0 bg-ak-bg/85 backdrop-blur-sm"
            onClick={onClose}
            aria-label={t.search.close}
          />
          <SearchPanel onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLocale()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const hits = useMemo<SearchHit[]>(() => (query.trim() ? searchPosts(query, 8) : []), [query])

  // Focus on mount. The panel only mounts when opened, so this runs once.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 40)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (hits.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => (index + 1) % hits.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) => (index - 1 + hits.length) % hits.length)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const hit = hits[active]
        if (hit) {
          navigate(`/blog/${hit.post.slug}`)
          onClose()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hits, active, navigate, onClose])

  return (
    <motion.div
      className="ak-panel relative w-full max-w-2xl"
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -8, opacity: 0 }}
      transition={{ duration: 0.18, ease: EASE_AK }}
    >
      <div className="flex items-center gap-3 border-b border-ak-border px-4 py-3">
        <SearchIcon size={16} className="shrink-0 text-ak-accent" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            // Reset the highlight, otherwise it can point past the new
            // (shorter) result list.
            setActive(0)
          }}
          placeholder={t.search.placeholder}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ak-text outline-none placeholder:text-ak-muted/60"
          aria-label={t.search.inputLabel}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-ak-muted transition-colors hover:text-ak-accent"
          aria-label={t.common.close}
        >
          <X size={15} />
        </button>
      </div>

      <div className="max-h-[52vh] overflow-y-auto">
        {query.trim() === '' ? (
          <div className="px-4 py-8 text-center">
            <p className="font-mono text-2xs tracking-ak text-ak-muted">
              {t.search.hint} - {postMetas.length} {t.search.hintCount}
            </p>
          </div>
        ) : hits.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="font-mono text-2xs tracking-ak text-ak-muted">
              {t.search.noMatch} {QUOTE_OPEN}
              {query.toUpperCase()}
              {QUOTE_CLOSE}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ak-border">
            {hits.map((hit, index) => (
              <li key={hit.post.slug}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    navigate(`/blog/${hit.post.slug}`)
                    onClose()
                  }}
                  className={`flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-ak ${
                    index === active ? 'bg-ak-surface-2' : 'hover:bg-ak-surface-2/60'
                  }`}
                >
                  <span
                    className={`h-6 w-px shrink-0 ${index === active ? 'bg-ak-accent' : 'bg-ak-border'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ak-text">{hit.post.title}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="ak-index">{hit.post.code}</span>
                      <span className="font-mono text-2xs text-ak-muted">
                        {formatDate(hit.post.date)}
                      </span>
                    </span>
                  </span>
                  <CornerDownLeft
                    size={13}
                    className={`shrink-0 ${index === active ? 'text-ak-accent' : 'text-transparent'}`}
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-ak-border px-4 py-2.5">
        <span className="font-mono text-[0.625rem] tracking-ak text-ak-muted">{t.search.keys}</span>
        <span className="font-mono text-[0.625rem] tracking-ak text-ak-muted/60">
          {t.search.engine}
        </span>
      </div>
    </motion.div>
  )
}
