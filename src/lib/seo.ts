/**
 * SEO helpers. Hand-rolled rather than pulling in react-helmet-async: a static SPA only
 * needs to swap a title and a handful of meta tags.
 */
import { useEffect } from 'react'

import { site } from '@/data/site'
import { LOCALE_TAGS } from '@/data/strings'
import { useLocale } from '@/lib/locale'

/**
 * Size of the generated `public/brand/og.png`, duplicated from `scripts/build-icons.mjs`
 * because the crawler reads these tags from the document and the build script's constants
 * are not in the bundle. The icon generator asserts the rendered dimensions against this.
 */
const OG_IMAGE = { width: 1200, height: 630 } as const

interface SeoOptions {
  /** Page title. The site name is appended automatically. */
  title?: string
  description?: string
  /** Site-relative path, e.g. /blog/hello */
  path?: string
  type?: 'website' | 'article'
  publishedTime?: string
  tags?: string[]
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value)
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

export function useSeo({
  title,
  description,
  path = '/',
  type = 'website',
  publishedTime,
  tags,
}: SeoOptions) {
  /* Destructured to stable primitives, because those are what the dependency array has to
     name. Forgetting the locale would leave the meta tags describing the previous language
     after a switch - invisible on the page, visible to every crawler. */
  const { locale, t } = useLocale()
  const { keywords } = t.content
  const fallbackDescription = t.meta.site

  useEffect(() => {
    /* Every route names itself; the fallback is the bare site name, which is unhelpful but
       not wrong, and better than rendering `undefined`. */
    const fullTitle = title ? `${title} | ${site.name}` : site.name
    const desc = description ?? fallbackDescription
    const url = `${site.url}${path}`
    /* The PNG, not the SVG: Twitter, Facebook, Discord and Slack do not render an SVG
       `og:image`. The dimensions let a crawler reserve the space before it has the image. */
    const image = `${site.url}/brand/og.png`

    document.title = fullTitle

    upsertMeta('meta[name="description"]', { name: 'description', content: desc })
    upsertMeta('meta[name="keywords"]', {
      name: 'keywords',
      content: (tags && tags.length > 0 ? tags : keywords).join(', '),
    })

    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: desc })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type })
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
    upsertMeta('meta[property="og:image:type"]', {
      property: 'og:image:type',
      content: 'image/png',
    })
    upsertMeta('meta[property="og:image:width"]', {
      property: 'og:image:width',
      content: String(OG_IMAGE.width),
    })
    upsertMeta('meta[property="og:image:height"]', {
      property: 'og:image:height',
      content: String(OG_IMAGE.height),
    })
    /* Announce the language. Crawlers use it to decide which audience a link
       preview is for, and getting it wrong is worse than leaving it out. */
    upsertMeta('meta[property="og:locale"]', {
      property: 'og:locale',
      content: LOCALE_TAGS[locale].og,
    })

    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle })
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: desc,
    })

    if (publishedTime) {
      upsertMeta('meta[property="article:published_time"]', {
        property: 'article:published_time',
        content: publishedTime,
      })
    }

    upsertLink('canonical', url)
  }, [title, description, path, type, publishedTime, tags, locale, fallbackDescription, keywords])
}
