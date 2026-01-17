import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={clsx(
        "h-11 w-full rounded-xl bg-[var(--card)] border border-[var(--border)] px-3 text-sm outline-none",
        "focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/60",
        className,
      )}
      {...props}
    />
  )
}
