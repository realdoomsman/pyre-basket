import type { Candle, Coin } from "./coins";
import { apportion } from "./weights";

export interface Leg {
  slug: string;
  ticker: string;
  weight: number;
}

/**
 * A broken feed can report thousands of percent for one coin; averaging that into a basket
 * headline would make the whole number a lie, so such legs do not contribute and the headline
 * says how much weight it covers. Coins under a day old report their move since launch rather
 * than a true 24h figure; they count, and `sinceLaunch` says how much of the basket that is.
 */
const MAX_SANE_24H_PCT = 400;

export interface Weighted24h {
  /** Weighted change in percent, or null when no leg has a usable figure. */
  pct: number | null;
  /** Share of the basket (0–1) the figure is based on. */
  coverage: number;
  /** Share of the basket (0–1) whose figure is measured since launch, not since yesterday. */
  sinceLaunch: number;
}

export function weighted24h(legs: Leg[], bySlug: Record<string, Coin>): Weighted24h {
  let acc = 0;
  let covered = 0;
  let young = 0;
  let total = 0;
  for (const leg of legs) {
    total += leg.weight;
    const coin = bySlug[leg.slug];
    const change = coin?.change24hPct;
    if (change == null || Math.abs(change) > MAX_SANE_24H_PCT) continue;
    acc += leg.weight * change;
    covered += leg.weight;
    if (coin?.young) young += leg.weight;
  }
  if (covered === 0 || total === 0) return { pct: null, coverage: 0, sinceLaunch: 0 };
  return { pct: acc / covered, coverage: covered / total, sinceLaunch: young / total };
}

/** Combined market cap of the legs the host could price. */
export function totalMarketCap(legs: Leg[], bySlug: Record<string, Coin>): number {
  return legs.reduce((acc, leg) => acc + (bySlug[leg.slug]?.mcapUsd ?? 0), 0);
}

export interface Sizing {
  slug: string;
  ticker: string;
  weight: number;
  /** Whole cents; the rows sum exactly to the budget. */
  cents: number;
  /** Tokens that many dollars buy at the live price; null when unpriced. */
  tokens: number | null;
}

/** Splits a budget across legs in whole cents (largest remainder) and sizes each leg at its live price. */
export function sizeLegs(budgetCents: number, legs: Leg[], bySlug: Record<string, Coin>): Sizing[] {
  const parts = apportion(
    budgetCents,
    legs.map((l) => l.weight),
  );
  return legs.map((leg, i) => {
    const cents = parts[i] ?? 0;
    const price = bySlug[leg.slug]?.priceUsd ?? 0;
    return { slug: leg.slug, ticker: leg.ticker, weight: leg.weight, cents, tokens: price > 0 ? cents / 100 / price : null };
  });
}

export interface CurvePoint {
  t: number;
  /** Index level, 100 at the first hour. */
  value: number;
}

export interface EquityCurve {
  points: CurvePoint[];
  /** Change over the whole window in percent, or null when there are too few points. */
  changePct: number | null;
  /** Share of weight (0–1) with candle history. */
  coverage: number;
}

/**
 * Weighted, rebased index of the legs' hourly closes: each leg is rebased to 1 at the first
 * hour the whole set shares, multiplied by its weight and summed. Legs without history are left
 * out and reported through `coverage` instead of being faked.
 */
export function equityCurve(legs: Leg[], candlesBySlug: Record<string, Candle[]>): EquityCurve {
  const series = legs
    .map((leg) => ({ weight: leg.weight, candles: candlesBySlug[leg.slug] ?? [] }))
    .filter((s) => s.candles.length >= 2);
  const totalWeight = legs.reduce((acc, l) => acc + l.weight, 0);
  const covered = series.reduce((acc, s) => acc + s.weight, 0);
  if (series.length === 0 || totalWeight === 0) return { points: [], changePct: null, coverage: 0 };

  // Shared window: from the latest first-candle to the earliest last-candle, on the hour.
  const start = Math.max(...series.map((s) => s.candles[0]?.t ?? 0));
  const end = Math.min(...series.map((s) => s.candles[s.candles.length - 1]?.t ?? 0));
  if (end <= start) return { points: [], changePct: null, coverage: covered / totalWeight };

  const HOUR = 3_600_000;
  const first = Math.ceil(start / HOUR) * HOUR;
  const points: CurvePoint[] = [];
  const cursors = series.map(() => 0);
  const bases: number[] = [];

  for (let t = first; t <= end; t += HOUR) {
    let level = 0;
    for (let i = 0; i < series.length; i += 1) {
      const s = series[i];
      if (!s) continue;
      // Carry the last close at or before `t` forward across gaps.
      let k = cursors[i] ?? 0;
      while (k + 1 < s.candles.length && (s.candles[k + 1]?.t ?? Infinity) <= t) k += 1;
      cursors[i] = k;
      const close = s.candles[k]?.c ?? 0;
      if (bases[i] === undefined) bases[i] = close > 0 ? close : 1;
      level += (s.weight / covered) * (close / (bases[i] ?? 1));
    }
    points.push({ t, value: level * 100 });
  }
  const last = points[points.length - 1]?.value;
  return { points, changePct: last === undefined ? null : last - 100, coverage: covered / totalWeight };
}
