export const MIN_COINS = 2;
export const MAX_COINS = 12;

/**
 * Largest-remainder rounding: distributes `total` integer units across `weights` so the parts
 * add back up exactly. Ties go to the larger weight, then to the earlier row, so the result is
 * deterministic and stable while a slider moves.
 */
export function apportion(total: number, weights: number[]): number[] {
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((acc, w) => acc + w, 0);
  if (sum === 0 || total <= 0) return clean.map(() => 0);
  const rows = clean.map((w, index) => {
    const exact = (total * w) / sum;
    const base = Math.floor(exact);
    return { index, weight: w, base, rest: exact - base };
  });
  let left = total - rows.reduce((acc, r) => acc + r.base, 0);
  const order = [...rows].sort((a, b) => b.rest - a.rest || b.weight - a.weight || a.index - b.index);
  for (const row of order) {
    if (left <= 0) break;
    row.base += 1;
    left -= 1;
  }
  return rows.map((r) => r.base);
}

/** Even split that still totals 100: the first `100 % n` coins get one extra point. */
export function evenWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const extra = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Rescales arbitrary weights to sum to exactly 100, keeping every coin at 1% or more. */
export function scaleTo100(weights: number[]): number[] {
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  if (clean.every((w) => w === 0)) return evenWeights(weights.length);
  const scaled = apportion(100, clean);
  // A coin at 0% is not in the basket; lift it to 1% and take the point from the largest slice.
  for (let i = 0; i < scaled.length; i += 1) {
    if (scaled[i] !== 0) continue;
    let biggest = 0;
    for (let j = 1; j < scaled.length; j += 1) if ((scaled[j] ?? 0) > (scaled[biggest] ?? 0)) biggest = j;
    if ((scaled[biggest] ?? 0) > 1) {
      scaled[biggest] = (scaled[biggest] ?? 0) - 1;
      scaled[i] = 1;
    }
  }
  return scaled;
}

/* ---- Heat ramp -------------------------------------------------------------------------- */

const RAMP = ["#1C1B2E", "#3B2F7A", "#7A66F5", "#3E8BFF", "#9CD2FF", "#E9F1FF"] as const;

function mix(a: string, b: string, t: number): string {
  const channel = (offset: number): string => {
    const from = parseInt(a.slice(offset, offset + 2), 16);
    const to = parseInt(b.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * t)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Colour at position `t` (0 = coldest, 1 = hottest) along the Pyre heat ramp. */
export function heat(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(scaled));
  return mix(RAMP[i] as string, RAMP[i + 1] as string, scaled - i);
}

/**
 * One ramp colour per coin, hottest for the heaviest. Ranked rather than proportional so
 * neighbouring slices always differ, and floored at 0.28 so the coldest stays visible on
 * the surface colour.
 */
export function heatByRank(weights: number[]): string[] {
  const order = weights
    .map((weight, index) => ({ weight, index }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const colours = new Array<string>(weights.length);
  const n = weights.length;
  order.forEach((row, rank) => {
    const t = n === 1 ? 1 : 1 - rank / (n - 1);
    colours[row.index] = heat(0.28 + t * 0.72);
  });
  return colours;
}

/**
 * Heat colour for a 24h move, kept in the readable half of the ramp: flat sits at heat-4/5,
 * ±25% and beyond pin to violet (loss) and near-white (gain). The ramp is the only colour the
 * design allows for intensity.
 */
export function heatForChange(pctChange: number | null): string {
  if (pctChange == null) return "#6b6a66";
  return heat(0.7 + Math.max(-1, Math.min(1, pctChange / 25)) * 0.3);
}
