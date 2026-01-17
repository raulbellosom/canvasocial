import type { PropsWithChildren } from 'react'
import { clsx } from 'clsx'

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx("rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm", className)}>
      {children}
    </div>
  )
}
