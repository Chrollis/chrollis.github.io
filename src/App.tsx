import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import Cursor from '@/components/Cursor'
import LoadingScreen from '@/components/LoadingScreen'
import OverlayScrollbar from '@/components/OverlayScrollbar'
import PageLoader from '@/components/PageLoader'
import ScrollToTop from '@/components/ScrollToTop'
import SiteBackground from '@/components/SiteBackground'
import SiteFooter from '@/components/SiteFooter'
import SiteHeader from '@/components/SiteHeader'
import ThemeTransition from '@/components/ThemeTransition'

// The home page is on the critical path, so it ships in the main bundle.
import Home from '@/pages/Home'

// Everything else is fetched on demand.
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'))
const AboutPage = lazy(() => import('@/pages/AboutPage'))
const BlogPage = lazy(() => import('@/pages/BlogPage'))
const BlogPostPage = lazy(() => import('@/pages/BlogPostPage'))
const ContactPage = lazy(() => import('@/pages/ContactPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export default function App() {
  const location = useLocation()

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Entry overlay. Self-contained: it removes itself when done, so it
          never re-runs on in-app navigation. */}
      <LoadingScreen />

      {/* Loads three itself lazily, so the first paint is unaffected */}
      <SiteBackground />

      <SiteHeader />

      <main id="main" className="relative z-10 flex-1">
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>

      <SiteFooter />
      <ScrollToTop />
      {/* Replaces the native scrollbar, which would consume layout width and shift the
          page sideways between routes. */}
      <OverlayScrollbar />

      {/* The theme colour wash: above every panel, below the cursor. */}
      <ThemeTransition />

      {/* Last, so it stacks above the entry overlay: a cursor the loading screen could
          cover would leave the visitor with no pointer for the first second. Fixed and
          `pointer-events: none`, so it is in the tree for stacking only. */}
      <Cursor />
    </div>
  )
}
