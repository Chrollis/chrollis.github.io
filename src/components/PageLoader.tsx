/** Placeholder for lazy-loaded routes: keeps the loading state on-brand. */
import { useLocale } from '@/lib/locale'

export default function PageLoader() {
  const { t } = useLocale()
  return (
    <div className="ak-container flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="ak-label">{t.common.loading}</span>
          <span className="ak-index">{t.common.pleaseWait}</span>
        </div>
        <div className="h-px w-full bg-ak-border">
          <div className="h-px w-1/3 animate-sweep bg-ak-accent" />
        </div>
      </div>
    </div>
  )
}
