/**
 * Site identity and feature flags. Facts only: anything a reader reads lives in
 * `src/data/locales/`. A URL, handle or flag is identical in every language, so
 * duplicating it there would mean two sources of truth. No English sentences here
 * other than proper nouns.
 */

/** Selects the glyph used by src/components/BrandIcons.tsx */
export type SocialIcon =
  | 'github'
  | 'mail'
  | 'rss'
  | 'external'
  | 'twitter'
  | 'bilibili'
  | 'afdian'
  | 'zhihu'
  | 'steam'
  | 'youtube'

/**
 * Keys into `t.socials` - not the href or the icon, either of which can change
 * independently of the label.
 */
export type SocialKey = 'github' | 'bilibili' | 'afdian' | 'email'

export interface SocialLink {
  /** Label key in `t.socials`. */
  key: SocialKey
  /** Absolute URL, or a site-relative path when it starts with "/" */
  href: string
  icon: SocialIcon
  /** Decorative counter next to the label. */
  code: string
}

/** Keys into `t.pages`. */
export type NavKey = 'home' | 'projects' | 'about' | 'blog' | 'contact'

export interface NavItem {
  /** Label key in `t.pages`. */
  key: NavKey
  to: string
  /** Serial number; never translated. */
  index: string
}

export const site = {
  /** Display name / handle */
  name: 'Chrollis',
  /** Uppercase form used for the oversized hero wordmark */
  nameUpper: 'CHROLLIS',

  /** Canonical origin, no trailing slash */
  url: 'https://chrollis.github.io',
  github: 'Chrollis',

  /*
   * Held in two pieces, never as one joined string: a literal `user@domain` in the
   * bundle is what a scraper's regex looks for, and this module is imported everywhere.
   * `fullEmail()` assembles it on demand. A SimpleLogin alias, so the response to abuse
   * is replacing the alias - never a personal mailbox.
   */
  email: {
    user: 'chrollis.contact.countable246',
    domain: 'aleeas.com',
  },

  /** Decorative cover readout, rounded to a tenth of a degree: an instrument, not an address. */
  coordinates: '30.6N / 104.1E',

  /*
   * Display order. The email entry's `href` is deliberately empty: `SocialLinks`
   * special-cases it and renders `EmailLink`, so no `mailto:` with a real address
   * exists in the DOM or the bundle. RSS is not here - it is a feed of this site, not
   * a profile elsewhere, so it lives in the footer's Files column.
   */
  socials: [
    { key: 'github', href: 'https://github.com/Chrollis', icon: 'github', code: 'GH' },
    { key: 'bilibili', href: 'https://space.bilibili.com/349484809', icon: 'bilibili', code: 'BL' },
    { key: 'afdian', href: 'https://afdian.com/a/chrollis', icon: 'afdian', code: 'AFD' },
    { key: 'email', href: '', icon: 'mail', code: 'MAIL' },
  ] as SocialLink[],

  /** Routes. Labels come from `t.pages[key]`, so this holds structure only. */
  nav: [
    { key: 'home', to: '/', index: '00' },
    { key: 'projects', to: '/projects', index: '01' },
    { key: 'about', to: '/about', index: '02' },
    { key: 'blog', to: '/blog', index: '03' },
    { key: 'contact', to: '/contact', index: '04' },
  ] as NavItem[],

  /** Giscus comments. An empty `repoId` hides the box rather than rendering a broken frame. */
  giscus: {
    enabled: false,
    repo: 'Chrollis/chrollis.github.io',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    mapping: 'pathname' as const,
    lang: 'en',
  },

  /*
   * FormSubmit by default: no account, no API key, its own reCAPTCHA (`_captcha`) plus
   * a `_honey` honeypot in the markup. The endpoint takes the address directly; its
   * opaque "Invisible emails" alias was dropped once the address became plain on the
   * page. One-time step: the first submission sends a confirmation email, and messages
   * are held until the link in it is clicked.
   *
   * Web3Forms is the alternative for real traffic: an access key, no confirmation step,
   * and the key can live in a repository secret rather than the bundle.
   */
  contactForm: {
    provider: 'formsubmit' as 'web3forms' | 'formsubmit' | 'none',
    /*
     * Optional chaining is load-bearing, not defensive style: `import.meta.env` only
     * exists inside Vite, and the build scripts import this module under Node, where a
     * plain access throws and takes the build down.
     */
    web3formsKey: import.meta.env?.VITE_WEB3FORMS_KEY ?? '',
  },

  /** Repo credited on the statistics cards; the numbers arrive via `src/generated/github-data.json`. */
  statsRepo: 'Chrollis/github-stats-chrollis',

  /** First year the site existed, for the footer copyright range */
  since: 2026,
}

export const navItems = site.nav

/** True when a config value has not been filled in yet. */
export const isBlank = (value: string | undefined | null): boolean => !value || value.trim() === ''

/**
 * The contact address, assembled from its two halves only when called. A module-level
 * constant would put one literal `user@domain` string in the bundle for a scraper's
 * regex to match. That defeats the cheaper class of scraper and nothing else.
 */
export function fullEmail(): string {
  return `${site.email.user}@${site.email.domain}`
}
