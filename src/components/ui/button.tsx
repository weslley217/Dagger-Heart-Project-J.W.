"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_12px_32px_rgba(20,92,92,0.28)] hover:bg-[var(--accent-strong)]",
  secondary:
    "bg-white/12 text-white ring-1 ring-white/10 hover:bg-white/18",
  ghost:
    "bg-transparent text-[var(--foreground)] ring-1 ring-white/10 hover:bg-white/6",
  danger:
    "bg-[#9b2c2c] text-white hover:bg-[#7d2323]",
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
