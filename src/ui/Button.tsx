import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-medium transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    icon: "size-10 text-sm",
  }[size];
  const variants =
    variant === "primary"
      ? "bg-[var(--accent)] text-white hover:opacity-90 shadow-sm"
      : variant === "danger"
        ? "bg-[var(--danger)] text-white hover:opacity-90"
        : "bg-transparent hover:bg-white/5 text-[var(--fg)]";
  return (
    <button className={clsx(base, sizes, variants, className)} {...props} />
  );
}
