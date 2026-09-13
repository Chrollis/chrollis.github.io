import { Moon, Sun } from 'lucide-react'

import { useLocale } from '@/lib/locale'
import { switchTheme, useTheme } from '@/lib/theme'

export default function ThemeToggle({ className }: { className?: string }) {
  const { t } = useLocale()
  const { isDark } = useTheme()
  const label = isDark ? t.nav.toggleLight : t.nav.toggleDark
  const next = isDark ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => switchTheme(next)}
      className={`group relative flex h-10 w-10 items-center justify-center border border-ak-border text-ak-muted transition-colors duration-ak hover:border-ak-accent hover:text-ak-accent ${className ?? ''}`}
      aria-label={label}
      title={label}
    >
      {isDark ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
      <span className="absolute -bottom-px left-0 h-px w-0 bg-ak-accent transition-all duration-ak group-hover:w-full" />
    </button>
  )
}
