import { useEffect, useRef, useState } from 'react'

import { site } from '@/data/site'
import { useLocale } from '@/lib/locale'

/**
 * Giscus comments, running on GitHub Discussions so a static host needs no backend. When
 * `repoId`/`categoryId` are unset the component renders nothing rather than a frame that
 * fails to load. Setup is in the README.
 */
export default function CommentBox({ term }: { term?: string }) {
  const { t, locale } = useLocale()
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  const { enabled, repo, repoId, category, categoryId, mapping } = site.giscus
  const configured = Boolean(enabled && repo && repoId && categoryId)

  useEffect(() => {
    if (!configured) return
    const container = containerRef.current
    if (!container) return

    // Clear first so a remount cannot leave two frames behind.
    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.async = true
    script.crossOrigin = 'anonymous'
    script.setAttribute('data-repo', repo)
    script.setAttribute('data-repo-id', repoId)
    script.setAttribute('data-category', category)
    script.setAttribute('data-category-id', categoryId)
    script.setAttribute('data-mapping', term ? 'specific' : mapping)
    if (term) script.setAttribute('data-term', term)
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'top')
    // Giscus renders in an iframe and cannot read our CSS variables, so it
    // needs an explicit theme name. See the README for syncing it.
    const theme = document.documentElement.getAttribute('data-theme')
    script.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark_dimmed')
    // Giscus renders its own UI, so it needs to be told the language - it cannot
    // read ours. `zh-CN` is the tag it documents; our internal tag is `zh-Hans`.
    script.setAttribute('data-lang', locale === 'zh' ? 'zh-CN' : 'en')
    script.setAttribute('data-loading', 'lazy')

    script.onload = () => setReady(true)
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [configured, repo, repoId, category, categoryId, mapping, locale, term])

  if (!configured) return null

  return (
    <section className="mt-16 border-t border-ak-border pt-10">
      <div className="flex items-center gap-3 pb-6">
        <span className="ak-label">{t.comments.label}</span>
        <span className="h-px flex-1 bg-ak-border" />
        <span className="ak-index">{t.comments.poweredBy}</span>
      </div>

      {!ready && (
        <p className="mb-4 font-mono text-2xs tracking-ak text-ak-muted">{t.comments.loading}</p>
      )}
      <div ref={containerRef} />
    </section>
  )
}
