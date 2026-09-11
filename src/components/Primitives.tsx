import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { fadeUp, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Page-level layout primitives. Variants live in `lib/motion` so this module only exports components. */

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={stagger}
      className={cn('pb-section', className)}
    >
      {children}
    </motion.div>
  )
}

export function PageHeader({
  index,
  title,
  subtitle,
  description,
}: {
  index: string
  title: string
  subtitle?: string
  description?: string
}) {
  return (
    <motion.header variants={fadeUp} className="ak-container pb-10 pt-12 md:pb-14 md:pt-16">
      <div className="flex items-center gap-3">
        <span className="ak-index">{index}</span>
        <span className="h-px flex-1 bg-ak-border" />
        {subtitle && <span className="ak-label">{subtitle}</span>}
      </div>

      <h1 className="mt-6 text-headline font-bold text-ak-text">{title}</h1>

      {description && (
        <p className="ak-text-pretty ak-cjk mt-4 max-w-2xl text-sm leading-relaxed text-ak-muted md:text-base">
          {description}
        </p>
      )}
    </motion.header>
  )
}

export function Panel({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode
  className?: string
  interactive?: boolean
}) {
  return (
    <div
      className={cn(
        'ak-panel',
        interactive && 'ak-corners transition-colors duration-ak hover:border-ak-border/80',
        className,
      )}
    >
      {children}
    </div>
  )
}
