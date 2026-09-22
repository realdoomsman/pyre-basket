import { useMemo, useState } from "react";
import { OTHER_COLOR, SERIES_MAX, seriesColor } from "../lib";
import type { TokenWeight } from "../types";

interface Slice {
  label: string;
  name: string;
  weight: number;
  color: string;
  folded: string[];
}

const RADIUS = 70;
const STROKE = 26;
const CIRC = 2 * Math.PI * RADIUS;
/** 3 units of surface between slices so neighbouring fills never touch. */
const GAP = 3;

/** Sorted largest-first, with anything past the 8th colour folded into one "Other" slice. */
function toSlices(tokens: TokenWeight[]): Slice[] {
  const sorted = [...tokens]
    .filter((t) => t.ticker !== "" && t.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.ticker.localeCompare(b.ticker));
  if (sorted.length <= SERIES_MAX) {
    return sorted.map((t, i) => ({
      label: t.ticker,
      name: t.name ?? "",
      weight: t.weight,
      color: seriesColor(i),
      folded: [],
    }));
  }
  const head = sorted.slice(0, SERIES_MAX - 1);
  const tail = sorted.slice(SERIES_MAX - 1);
  return [
    ...head.map((t, i) => ({
      label: t.ticker,
      name: t.name ?? "",
      weight: t.weight,
      color: seriesColor(i),
      folded: [],
    })),
    {
      label: "Other",
      name: `${tail.length} smaller coins`,
      weight: tail.reduce((acc, t) => acc + t.weight, 0),
      color: OTHER_COLOR,
      folded: tail.map((t) => t.ticker),
    },
  ];
}

export default function WeightBreakdown({ tokens, caption }: { tokens: TokenWeight[]; caption?: string }) {
  const slices = useMemo(() => toSlices(tokens), [tokens]);
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((acc, s) => acc + s.weight, 0);

  if (slices.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-edge/80 px-4 py-8 text-center text-sm text-ink-faint">
        Add coins and weights to see the breakdown.
      </p>
    );
  }

  const shown = active === null ? null : slices[active];
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
      <svg
        aria-label={`Weight breakdown: ${slices.map((s) => `${s.label} ${s.weight}%`).join(", ")}`}
        className="h-44 w-44 shrink-0"
        role="img"
        viewBox="0 0 200 200"
      >
        <g transform="rotate(-90 100 100)">
          {slices.map((slice, index) => {
            const span = (CIRC * slice.weight) / (total || 100);
            const len = Math.max(1, span - GAP);
            const dash = `${len} ${Math.max(0, CIRC - len)}`;
            const thisOffset = offset;
            offset += span;
            return (
              <circle
                cx="100"
                cy="100"
                fill="none"
                key={`${slice.label}-${index}`}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                opacity={active === null || active === index ? 1 : 0.45}
                r={RADIUS}
                stroke={slice.color}
                strokeDasharray={dash}
                strokeDashoffset={-thisOffset}
                strokeWidth={active === index ? STROKE + 4 : STROKE}
                style={{ pointerEvents: "stroke", transition: "opacity 120ms, stroke-width 120ms" }}
              >
                <title>{`${slice.label}: ${slice.weight}%`}</title>
              </circle>
            );
          })}
        </g>
        <text className="fill-ink text-[22px] font-semibold" textAnchor="middle" x="100" y="97">
          {shown ? `${shown.weight}%` : `${slices.length}`}
        </text>
        <text className="fill-ink-faint text-[11px]" textAnchor="middle" x="100" y="116">
          {shown ? shown.label : slices.length === 1 ? "coin" : "coins"}
        </text>
      </svg>

      <div className="w-full min-w-0">
        <ul className="flex w-full flex-col gap-1">
          {slices.map((slice, index) => (
            <li
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
                active === index ? "bg-panel-2" : ""
              }`}
              key={`${slice.label}-row-${index}`}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-[3px]"
                style={{ backgroundColor: slice.color }}
              />
              <span className="font-semibold tracking-wide">{slice.label}</span>
              <span className="min-w-0 flex-1 truncate text-ink-faint">
                {slice.folded.length > 0 ? slice.folded.join(", ") : slice.name}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-ink-dim">{slice.weight}%</span>
            </li>
          ))}
        </ul>
        {caption ? <p className="mt-2 px-2 text-xs text-ink-faint">{caption}</p> : null}
        {total !== 100 ? (
          <p className="mt-2 px-2 text-xs text-warn">Weights currently total {total}% — they must reach 100%.</p>
        ) : null}
      </div>
    </div>
  );
}
