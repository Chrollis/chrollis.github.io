import ContactSection from '@/sections/ContactSection'
import { PageHeader, PageShell } from '@/components/Primitives'
import { useLocale } from '@/lib/locale'
import { useSeo } from '@/lib/seo'

/**
 * The header carries no description and the section carries no heading: both used to print
 * `t.contact.intro`, so the paragraph appeared twice on a short page.
 */
export default function ContactPage() {
  const { t } = useLocale()
  useSeo({
    title: t.pages.contact,
    path: '/contact',
    description: t.meta.contact,
  })

  return (
    <PageShell>
      <PageHeader index="04" title={t.pages.contact} subtitle={t.contact.subtitle} />
      <ContactSection />
    </PageShell>
  )
}
