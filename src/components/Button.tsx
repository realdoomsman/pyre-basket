import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` is violet with ink text — one per view. `secondary` is bordered, `ghost` is text only. */
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-violet text-bg hover:bg-violet-hover",
  secondary: "border border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-raised",
  ghost: "text-ink-muted hover:bg-surface hover:text-ink",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string): string {
  return cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-card font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

/** The only button. Violet primary, ink text, 8px radius; never white, never a gradient. */
export function Button({ variant = "primary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} type={type} {...rest} />;
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A link that looks exactly like `Button`, for navigation (`href="#/new"`). */
export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ButtonLinkProps) {
  return <a className={buttonClass(variant, size, className)} {...rest} />;
}
