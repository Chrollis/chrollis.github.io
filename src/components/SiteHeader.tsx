import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Search as SearchIcon, X } from 'lucide-react'

import LocaleToggle from '@/components/LocaleToggle'
import LogoMark from '@/components/LogoMark'
import SearchDialog from '@/components/SearchDialog'
import SocialLinks from '@/components/SocialLinks'
import ThemeToggle from '@/components/ThemeToggle'
import { site } from '@/data/site'
import { useLocale } from '@/lib/locale'
import { EASE_AK } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Must stay in step with the `min-[900px]` utilities on the nav and the menu button; it is
 * named here because JavaScript needs it too, and a breakpoint living in three places is
 * the kind of value that drifts.
 */
const DESKTOP_NAV_QUERY = '(min-width: 900px)'

export default function SiteHeader() {
  const { t } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Driven by scroll events only: scrollY starts at 0, and the browser fires a scroll event
  // when it restores a position, so no effect-time setState is needed.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Cmd/Ctrl + K toggles search
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  /*
   * Close the drawer once the window is wide enough for the real navigation. `menuOpen` is
   * also a scroll lock, so leaving it set after the drawer is gone stops the page scrolling
   * with no open menu to explain why - reachable by opening the drawer and widening past
   * 900px. A media query rather than a resize handler, so it fires only on the transition.
   */
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_NAV_QUERY)

    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false)
    }
    desktop.addEventListener('change', onChange)
    return () => desktop.removeEventListener('change', onChange)
  }, [])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-overlay focus:border focus:border-ak-accent focus:bg-ak-bg focus:px-3 focus:py-2 focus:font-mono focus:text-xs"
      >
        {t.common.skipToContent}
      </a>

      <header
        className={cn(
          'sticky top-0 z-nav border-b transition-colors duration-ak',
          scrolled ? 'border-ak-border bg-ak-bg/88 backdrop-blur-md' : 'border-transparent',
        )}
      >
        {/*
          * Three columns, not `justify-between`: with `justify-between` the middle child is
          * only centred if the outer two are the same width, and here the logo is 40px
          * against a control cluster well over 100px. `minmax(0, 1fr)` on the outer columns
          * is load-bearing - a bare `1fr` resolves to `minmax(auto, 1fr)` and cannot shrink
          * below its content, which left the nav 31px off centre.
          *
          * Two columns below 900px, three above. `display: none` removes the nav from grid
          * layout entirely, so the column count has to match the items actually rendered or
          * the controls land in the `auto` second column, which is sized before the `1fr`
          * tracks and left the brand 21px for a 40px box.
          */}
        <div className="ak-container grid h-16 grid-cols-2 items-center gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* Brand, in the same bordered square as the controls. Measured, the mark
              carries about four times the on-screen ink of the controls, so a bar that is
              centred geometrically still reads as leaning left. The 40px slot is not
              cosmetic either: the mark's bars are 2 units apart in a 64-unit box, so 24px
              leaves a 0.67px gap and renders as a solid block. See MARK_MIN_LEGIBLE_SIZE. */}
          <Link
            to="/"
            className="group flex h-10 w-10 shrink-0 items-center justify-center justify-self-start border border-ak-border text-ak-text transition-colors duration-ak hover:border-ak-accent hover:text-ak-accent"
            aria-label={`${site.name} - ${t.pages.home}`}
          >
            <LogoMark size={36} className="shrink-0" />
          </Link>

          <nav className="hidden items-center min-[900px]:flex" aria-label={t.nav.primary}>
            {site.nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    /*
                     * Intrinsic width with uniform padding, not equal boxes: HOME and
                     * CONTACT are different lengths, so fixed-width items mean unequal
                     * padding, and inconsistent padding is more visible than inconsistent
                     * width. Even spacing between items is what reads as order, and
                     * `px-3` gives 24px between labels whatever they say.
                     */
                    'group relative flex items-center gap-2 px-3 py-2 transition-colors duration-ak',
                    isActive ? 'text-ak-accent' : 'text-ak-muted hover:text-ak-text',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'font-mono text-[0.5625rem] tracking-ak transition-opacity duration-ak',
                        isActive ? 'opacity-100' : 'opacity-45',
                      )}
                    >
                      {item.index}
                    </span>
                    <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-ak">
                      {t.pages[item.key]}
                    </span>
                    {/* inset-x-3 aligns the rule with the text, since the item
                        itself has 12px of horizontal padding. */}
                    <span
                      className={cn(
                        'absolute inset-x-3 bottom-1 h-px bg-ak-accent transition-all duration-ak',
                        isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                      )}
                      style={{ transformOrigin: 'left' }}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/*
           * Global controls, all one form: evenly sized bordered squares with one even
           * gap, so the group reads as one panel. An earlier version mixed a bordered
           * search button with unbordered social icons and a bordered theme toggle, which
           * reads as one of them having lost its border. The social links were removed
           * rather than bordered - they are destinations, not controls, and are already in
           * the footer and on the contact page.
           *
           * Sizes and gaps do not change with the viewport; controls are dropped instead,
           * least load-bearing first. Shrinking them 40px to 32px below 360px looked like
           * the header flickering rather than adapting.
           *
           * Order: theme (dark is the default and the choice persists), then locale (the
           * only way to switch language), then search. The thresholds come from the
           * arithmetic rather than taste: with a 20px gutter, a 40px mark, a 16px grid gap
           * and an 8px control gap, `k` controls need `48k - 8` px. The cluster ends up
           * needing less than any real device; the floor exists so the header degrades
           * predictably instead of overlapping.
           */}
          <div className="flex min-w-0 shrink items-center justify-self-end gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-ak-border text-ak-muted transition-colors duration-ak hover:border-ak-accent hover:text-ak-accent max-[183px]:hidden"
              aria-label={t.nav.search}
            >
              {/* `shrink-0` is required: svg carries `max-width` in the base sheet and flex
                  items shrink by default, so without it the icon collapses to a few px. */}
              <SearchIcon size={15} strokeWidth={1.75} className="shrink-0" />
            </button>

            <ThemeToggle className="max-[279px]:hidden" />

            <LocaleToggle className="max-[231px]:hidden" />

            {/* Never dropped: below 900px this is the only way to reach About, Notes and
                Contact, which is why the cluster has a floor of one control. */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-ak-border text-ak-muted transition-colors duration-ak hover:border-ak-accent hover:text-ak-accent min-[900px]:hidden"
              aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <X size={16} className="shrink-0" />
              ) : (
                <Menu size={16} className="shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Hairline that fills in once the page is scrolled */}
        <div
          className={cn(
            'absolute bottom-0 left-0 h-px bg-ak-accent/70 transition-all duration-ak',
            scrolled ? 'w-full' : 'w-0',
          )}
        />
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            /*
             * `min-[900px]:hidden`, matching the button that opens it. This was
             * `md:hidden`, so between 768 and 899px the button was visible and the drawer
             * was not - pressing it did nothing, and `menuOpen` stayed stuck true.
             */
            className="fixed inset-0 z-overlay min-[900px]:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-ak-bg/80 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
              aria-label={t.nav.closeMenu}
            />

            <motion.nav
              className="absolute right-0 top-0 h-full w-[86%] max-w-sm border-l border-ak-border bg-ak-surface"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: EASE_AK, duration: 0.22 }}
              aria-label={t.nav.drawer}
            >
              <div className="flex h-16 items-center justify-between border-b border-ak-border px-5">
                <span className="ak-label">{t.nav.label}</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="text-ak-muted hover:text-ak-accent"
                  aria-label={t.nav.closeMenu}
                >
                  <X size={16} />
                </button>
              </div>

              <ul className="divide-y divide-ak-border">
                {site.nav.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      /* Close on click rather than watching the route in an effect: same
                         result, one render pass fewer. */
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center justify-between px-5 py-4 transition-colors duration-ak',
                          isActive ? 'bg-ak-bg text-ak-accent' : 'text-ak-text hover:bg-ak-bg',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="flex items-baseline gap-3">
                            <span className="ak-index">{item.index}</span>
                            <span className="text-lg">{t.pages[item.key]}</span>
                          </span>
                          {isActive && <span className="h-1.5 w-1.5 bg-ak-accent" />}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>

              {/* Stacked, label above the chips, not `justify-between`: on one row the
                  label and first chip sat 0px apart at 320px, and with a gap the list still
                  could not fit beside it below 375px. The drawer is at most 384px wide, so
                  there is no width where one row is comfortable. */}
              <div className="border-t border-ak-border px-5 py-5">
                <span className="ak-label">{t.nav.links}</span>
                <SocialLinks variant="full" className="mt-3" />
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
