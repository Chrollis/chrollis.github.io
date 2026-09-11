import CoverSection from '@/sections/CoverSection'
import { useSeo } from '@/lib/seo'

/**
 * A single full-height cover rather than a scrolling document. Everything that used to be
 * stacked below the fold has a route of its own.
 */
export default function Home() {
  /* No title: the fallback is the bare site name, which is what the home tab should say. */
  useSeo({ path: '/' })

  return <CoverSection />
}
