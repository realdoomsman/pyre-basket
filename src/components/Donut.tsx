import type { ReactNode } from "react";
import { heatByRank } from "../lib/weights";
import { cx } from "./cx";

export interface DonutProps {
  /** Weights in percent. Normalised for drawing, so an unfinished draft still renders. */
  slices: { ticker: string; weight: number }[];
  size?: number;
  thickness?: number;
  /** Index of the slice to emphasise; the rest dim. */
  highlight?: number | null;
  /** Rendered in the hole. */
  children?: ReactNode;
  className?: string;
}

/** Donut chart on the heat ramp. Pure SVG, scales with `size`, announces the split as text. */
export function Donut({ slices, size = 160, thickness = 22, highlight = null, children, className }: DonutProps) {
  const positive = slices.map((s) => ({ ticker: s.ticker, weight: Number.isFinite(s.weight) && s.weight > 0 ? s.weight : 0 }));
  const total = positive.reduce((acc, s) => acc + s.weight, 0);
  const colours = heatByRank(positive.map((s) => s.weight));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = positive.filter((s) => s.weight > 0).length > 1 ? 2.5 : 0;
  const label =
    total === 0
      ? "Empty basket"
      : `Weights: ${positive
          .filter((s) => s.weight > 0)
          .map((s) => `${s.ticker} ${Math.round((s.weight / total) * 100)}%`)
          .join(", ")}`;

  let offset = 0;
  const arcs = positive.map((s, i) => {
    const len = total === 0 ? 0 : (s.weight / total) * c;
    const start = offset;
    offset += len;
    if (len === 0) return null;
    const visible = Math.max(0, len - gap);
    return (
      <circle
        key={i}
        cx={size / 2}
        cy={size / 2}
        fill="none"
        opacity={highlight !== null && highlight !== i ? 0.3 : 1}
        r={r}
        stroke={colours[i]}
        strokeDasharray={`${visible} ${c - visible}`}
        strokeDashoffset={-start - gap / 2}
        strokeWidth={thickness}
        style={{ transition: "stroke-dasharray 200ms ease, stroke-dashoffset 200ms ease, opacity 150ms ease" }}
      />
    );
  });

  return (
    <div className={cx("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <svg aria-label={label} className="block" height={size} role="img" style={{ transform: "rotate(-90deg)" }} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={size / 2} cy={size / 2} fill="none" r={r} stroke="var(--color-border)" strokeWidth={thickness} />
        {arcs}
      </svg>
      {children !== undefined ? <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div> : null}
    </div>
  );
}
