import type { Candle, Coin } from "./coins";

/**
 * Stand-in coin universe for hosts without `/_pyre/coins` (vite dev/preview, the Playwright
 * run). Deliberately generic names and tickers: nothing here is a real coin, and every screen
 * that shows it says "example data".
 */
const BASE: Omit<Coin, "imageUrl" | "tokenAddress" | "phase" | "progress" | "launchedAt" | "young">[] = [
  { slug: "example-alpha", name: "Example Alpha", ticker: "EXA", priceUsd: 0.0000225, mcapUsd: 22_500_000, change24hPct: 12.4, volume24hUsd: 1_840_000, holders: 12_400 },
  { slug: "example-beta", name: "Example Beta", ticker: "EXB", priceUsd: 0.0042, mcapUsd: 4_200_000, change24hPct: -3.1, volume24hUsd: 610_000, holders: 3_180 },
  { slug: "example-gamma", name: "Example Gamma", ticker: "EXC", priceUsd: 0.00131, mcapUsd: 1_310_000, change24hPct: 41.7, volume24hUsd: 920_000, holders: 2_040 },
  { slug: "example-delta", name: "Example Delta", ticker: "EXD", priceUsd: 1.2, mcapUsd: 12_000_000, change24hPct: 0.8, volume24hUsd: 402_000, holders: 8_900 },
  { slug: "example-epsilon", name: "Example Epsilon", ticker: "EXE", priceUsd: 0.00000091, mcapUsd: 910_000, change24hPct: -18.6, volume24hUsd: 150_000, holders: 1_120 },
  { slug: "example-zeta", name: "Example Zeta", ticker: "EXF", priceUsd: 0.058, mcapUsd: 5_800_000, change24hPct: 6.3, volume24hUsd: 330_000, holders: 4_410 },
  { slug: "example-eta", name: "Example Eta", ticker: "EXG", priceUsd: 0.00034, mcapUsd: 340_000, change24hPct: null, volume24hUsd: 88_000, holders: 260 },
  { slug: "example-theta", name: "Example Theta", ticker: "EXH", priceUsd: 0.0097, mcapUsd: 970_000, change24hPct: -0.9, volume24hUsd: 74_000, holders: 730 },
];

export const EXAMPLE_COINS: Coin[] = BASE.map((c, i) => ({
  ...c,
  imageUrl: "",
  tokenAddress: `0x${(i + 1).toString(16).padStart(40, "0")}`,
  phase: i % 3 === 0 ? 2 : 0,
  launchedAt: null,
  young: false,
  progress: i % 3 === 0 ? 1 : 0.2 + i * 0.09,
}));

/** "Newest first" order for the example universe: the reverse of the trending order. */
export const EXAMPLE_NEW_ORDER = [...EXAMPLE_COINS].reverse();

/** Deterministic pseudo-random walk so the example chart is stable across runs. */
export function exampleCandles(slug: string, hours = 168): Candle[] {
  const coin = EXAMPLE_COINS.find((c) => c.slug === slug);
  if (!coin) return [];
  let seed = 0;
  for (const ch of slug) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = (): number => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 0xffffffff;
  };
  const end = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  // Spread the 24h move over the whole window so a week looks like a week, not 7× the day.
  const drift = ((coin.change24hPct ?? 0) / 100) / hours;
  const walk: number[] = [];
  let level = 1;
  for (let i = 0; i < hours; i += 1) {
    level *= 1 + drift + (rand() - 0.5) * 0.03;
    walk.push(level);
  }
  // Scale so the walk ends at the live price.
  const last = walk[walk.length - 1] ?? 1;
  return walk.map((v, i) => {
    const c = (v / last) * coin.priceUsd;
    const o = i === 0 ? c : ((walk[i - 1] ?? v) / last) * coin.priceUsd;
    return { t: end - (hours - 1 - i) * 3_600_000, o, h: Math.max(o, c) * 1.01, l: Math.min(o, c) * 0.99, c, v: coin.volume24hUsd / 24 };
  });
}
