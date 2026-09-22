import { pct } from "../lib/format";
import { heatForChange } from "../lib/weights";
import { cx } from "./cx";

export interface DeltaProps {
  /** Percent change; null renders "—" for a coin the feed could not price. */
  value: number | null;
  /** Share of the basket the figure covers; below 1 it is flagged as partial. */
  coverage?: number;
  /** The figure is measured from the launch price (coin under a day old), not from yesterday. */
  sinceLaunch?: boolean;
  className?: string;
}

/** A 24h move on the heat ramp: losses cool toward violet, gains warm toward near-white. */
export function Delta({ value, coverage = 1, sinceLaunch = false, className }: DeltaProps) {
  if (value === null) {
    return (
      <span className={cx("font-mono tabular-nums text-ink-faint", className)} title="No 24h figure from the feed">
        —
      </span>
    );
  }
  const partial = coverage < 0.999;
  const title = [partial ? `Based on ${Math.round(coverage * 100)}% of the basket; the rest has no usable 24h figure.` : "", sinceLaunch ? "Launched under a day ago: measured since launch, not since yesterday." : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cx("inline-flex items-baseline gap-1 font-mono tabular-nums", className)} style={{ color: heatForChange(value) }} title={title || undefined}>
      {pct(value)}
      {partial ? <span className="text-ink-faint">*</span> : null}
      {sinceLaunch ? <span className="text-xs uppercase tracking-[0.08em] text-ink-faint">launch</span> : null}
    </span>
  );
}
