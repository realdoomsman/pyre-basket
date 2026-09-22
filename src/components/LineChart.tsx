import type { CurvePoint } from "../lib/stats";

export interface LineChartProps {
  points: CurvePoint[];
  height?: number;
  label: string;
}

const W = 600;

/** Equity curve: index level over time, one line on the heat ramp with a baseline at 100. */
export function LineChart({ points, height = 180, label }: LineChartProps) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 100);
  const max = Math.max(...values, 100);
  const pad = (max - min) * 0.08 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number): number => (i / (points.length - 1)) * W;
  const y = (v: number): number => height - ((v - lo) / (hi - lo)) * height;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${W},${height} L0,${height} Z`;
  const last = points[points.length - 1]?.value ?? 100;
  const up = last >= 100;
  const stroke = up ? "var(--color-heat-5)" : "var(--color-heat-3)";
  const ticks = [lo + pad, 100, hi - pad];

  return (
    <svg aria-label={label} className="block w-full" height={height} preserveAspectRatio="none" role="img" viewBox={`0 0 ${W} ${height}`}>
      {ticks.map((v) => (
        <line key={v} stroke="var(--color-border)" strokeDasharray={v === 100 ? "none" : "3 5"} x1={0} x2={W} y1={y(v)} y2={y(v)} />
      ))}
      <path d={area} fill={stroke} opacity={0.12} />
      <path d={path} fill="none" stroke={stroke} strokeLinejoin="round" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle cx={W} cy={y(last)} fill={stroke} r={3.5} />
    </svg>
  );
}
