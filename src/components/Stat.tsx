import type { ReactNode } from "react";
import { cx } from "./cx";

export interface StatProps {
  label: string;
  children: ReactNode;
  /** Small muted line under the value. */
  note?: ReactNode;
  className?: string;
}

/** Eyebrow label over a mono display number. Used in rows of three or four. */
export function Stat({ label, children, note, className }: StatProps) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">{label}</span>
      <span className="font-mono text-2xl tabular-nums leading-none text-ink">{children}</span>
      {note !== undefined ? <span className="text-xs text-ink-faint">{note}</span> : null}
    </div>
  );
}
