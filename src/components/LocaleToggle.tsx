import { useLocale } from '@/lib/locale'

/**
 * Language toggle. The same 40px bordered square as the theme toggle, because they are the
 * same kind of thing: a global setting, not a link.
 *
 * It shows the language you are reading, matching the theme button's convention of showing
 * the current state. The glyph is the language's own name for itself (`EN`, `中`) - a button
 * labelled "ZH" would be accurate and mean nothing to the person who needs it.
 */
export default function LocaleToggle({ className }: { className?: string }) {
  const { t, toggle } = useLocale()

  return (
    <button
      type="button"
      onClick={toggle}
      className={`group relative flex h-10 w-10 items-center justify-center border border-ak-border text-ak-muted transition-colors duration-ak hover:border-ak-accent hover:text-ak-accent ${className ?? ''}`}
      aria-label={t.locale.switchTo}
      title={t.locale.switchTo}
      lang={t.locale.short === '中' ? 'zh-Hans' : 'en'}
    >
      {/* The one glyph on the site that must not inherit the page language: `中` needs the
          CJK stack even under `<html lang="en">`, which the `lang` attribute above handles. */}
      <span className="text-[0.8125rem] font-semibold leading-none">{t.locale.short}</span>
      <span className="absolute -bottom-px left-0 h-px w-0 bg-ak-accent transition-all duration-ak group-hover:w-full" />
    </button>
  )
}
