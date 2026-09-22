import { PyreError, pyreEnv, ship, type PyreCandle, type PyreCoin } from "@pyre/app-sdk";
import { useEffect, useMemo, useState } from "react";
import { EXAMPLE_COINS, EXAMPLE_NEW_ORDER, exampleCandles } from "./examples";

/** One coin launched on Pyre (Robinhood Chain, PONS v2), the subset of `PyreCoin` the app reads. */
export interface Coin {
  slug: string;
  name: string;
  ticker: string;
  imageUrl: string;
  tokenAddress: string;
  priceUsd: number;
  mcapUsd: number;
  /** Null when the feed sent no usable number. For a coin under a day old it is the move since launch. */
  change24hPct: number | null;
  /** Launched less than a day ago: `change24hPct` is measured from the launch price, not yesterday. */
  young: boolean;
  volume24hUsd: number;
  holders: number;
  /** 0 on the bonding curve, 2 in the pool. */
  phase: number;
  /** Curve raise ÷ graduation threshold, 0..1. */
  progress: number;
  launchedAt: string | null;
}

export interface Candle {
  /** Epoch milliseconds. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type CoinSort = "trending" | "new";

/** Where the numbers come from. Every screen shows it; example data is never presented as live. */
export type DataSource = "live" | "example";

/** The local dev host (`dev/pyre-local-host.ts`) has no coin routes; it identifies itself as `local`. */
export function dataSource(): DataSource {
  return pyreEnv().appId === "local" ? "example" : "live";
}

export function tradeUrl(slug: string): string {
  return `https://pyre.fun/c/${encodeURIComponent(slug)}`;
}

/* ---- Wire parsing ----------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Defensive copy of a feed record: the app never trusts a NaN or a missing field at render time. */
function toCoin(raw: PyreCoin): Coin | null {
  if (typeof raw.slug !== "string" || raw.slug === "") return null;
  const launchedAt = typeof raw.launchedAt === "string" ? raw.launchedAt : null;
  const young = launchedAt !== null && Date.now() - Date.parse(launchedAt) < DAY_MS;
  return {
    slug: raw.slug,
    name: typeof raw.name === "string" && raw.name !== "" ? raw.name : raw.slug,
    ticker: typeof raw.ticker === "string" && raw.ticker !== "" ? raw.ticker.toUpperCase() : raw.slug.toUpperCase().slice(0, 8),
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "",
    tokenAddress: typeof raw.tokenAddress === "string" ? raw.tokenAddress : "",
    priceUsd: num(raw.priceUsd),
    mcapUsd: num(raw.mcapUsd),
    change24hPct: typeof raw.change24hPct === "number" && Number.isFinite(raw.change24hPct) ? raw.change24hPct : null,
    young,
    volume24hUsd: num(raw.volume24hUsd),
    holders: num(raw.holders),
    phase: num(raw.phase),
    progress: num(raw.progress),
    launchedAt,
  };
}

function toCandle(raw: PyreCandle): Candle | null {
  const t = num(raw.t, NaN);
  const c = num(raw.c, NaN);
  if (!Number.isFinite(t) || !Number.isFinite(c)) return null;
  // The feed sends epoch seconds; tolerate milliseconds too.
  return { t: t < 1e12 ? t * 1000 : t, o: num(raw.o, c), h: num(raw.h, c), l: num(raw.l, c), c, v: num(raw.v) };
}

/* ---- Cache ------------------------------------------------------------------------------ */

const coinCache = new Map<string, Coin>();
const listCache = new Map<CoinSort, Promise<Coin[]>>();
const coinInflight = new Map<string, Promise<Coin | null>>();
const candleCache = new Map<string, Promise<Candle[]>>();

const LIST_LIMIT = 50;
const CANDLE_HOURS = 168;

export function listCoins(sort: CoinSort): Promise<Coin[]> {
  const cached = listCache.get(sort);
  if (cached) return cached;
  const job = (async () => {
    if (dataSource() === "example") return sort === "new" ? EXAMPLE_NEW_ORDER : EXAMPLE_COINS;
    const { items } = await ship.coins.list({ sort, limit: LIST_LIMIT });
    const coins = (Array.isArray(items) ? items : []).map(toCoin).filter((c): c is Coin => c !== null);
    for (const coin of coins) coinCache.set(coin.slug, coin);
    return coins;
  })();
  job.catch(() => listCache.delete(sort));
  listCache.set(sort, job);
  return job;
}

export function getCoin(slug: string): Promise<Coin | null> {
  const known = coinCache.get(slug);
  if (known) return Promise.resolve(known);
  const inflight = coinInflight.get(slug);
  if (inflight) return inflight;
  const job = (async () => {
    if (dataSource() === "example") return EXAMPLE_COINS.find((c) => c.slug === slug) ?? null;
    let raw: PyreCoin;
    try {
      raw = await ship.coins.get(slug);
    } catch (cause) {
      if (cause instanceof PyreError && cause.status === 404) return null;
      throw cause;
    }
    const coin = toCoin(raw);
    if (coin) coinCache.set(coin.slug, coin);
    return coin;
  })().finally(() => coinInflight.delete(slug));
  coinInflight.set(slug, job);
  return job;
}

export function getCandles(slug: string): Promise<Candle[]> {
  const cached = candleCache.get(slug);
  if (cached) return cached;
  const job = (async () => {
    if (dataSource() === "example") return exampleCandles(slug);
    const { candles } = await ship.coins.candles(slug, { interval: "1h", limit: CANDLE_HOURS });
    return (Array.isArray(candles) ? candles : [])
      .map(toCandle)
      .filter((c): c is Candle => c !== null)
      .sort((a, b) => a.t - b.t);
  })();
  job.catch(() => candleCache.delete(slug));
  candleCache.set(slug, job);
  return job;
}

/* ---- Hooks ------------------------------------------------------------------------------ */

export interface Universe {
  status: "loading" | "ready" | "error";
  error: string | null;
  /** Trending first, then anything only in "new". */
  coins: Coin[];
  /** The host's own orderings, untouched. */
  trending: Coin[];
  fresh: Coin[];
  bySlug: Record<string, Coin>;
  retry: () => void;
}

interface UniverseState {
  status: Universe["status"];
  error: string | null;
  coins: Coin[];
  trending: Coin[];
  fresh: Coin[];
}

/** Everything launched on Pyre that the app can build from: trending ∪ new, deduplicated. */
export function useUniverse(): Universe {
  const [state, setState] = useState<UniverseState>({ status: "loading", error: null, coins: [], trending: [], fresh: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading", error: null }));
    Promise.all([listCoins("trending"), listCoins("new")])
      .then(([trending, fresh]) => {
        if (cancelled) return;
        const seen: Record<string, true> = {};
        const coins: Coin[] = [];
        for (const coin of [...trending, ...fresh]) {
          if (seen[coin.slug]) continue;
          seen[coin.slug] = true;
          coins.push(coin);
        }
        setState({ status: "ready", error: null, coins, trending, fresh });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: cause instanceof Error ? cause.message : String(cause) }));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const bySlug = useMemo(() => {
    const map: Record<string, Coin> = {};
    for (const coin of state.coins) map[coin.slug] = coin;
    return map;
  }, [state.coins]);

  return { ...state, bySlug, retry: () => setAttempt((n) => n + 1) };
}

export interface CoinLookup {
  status: "loading" | "ready" | "error";
  error: string | null;
  bySlug: Record<string, Coin>;
  /** Slugs the host no longer serves (delisted, wrong id). */
  missing: string[];
  retry: () => void;
}

interface LookupState {
  key: string;
  status: CoinLookup["status"];
  error: string | null;
  bySlug: Record<string, Coin>;
  missing: string[];
}

/** Resolves an arbitrary set of slugs (a basket's legs) against the cache, fetching what is missing. */
export function useCoinsFor(slugs: string[]): CoinLookup {
  const key = [...new Set(slugs)].sort().join(",");
  const [state, setState] = useState<LookupState>({ key: "", status: "loading", error: null, bySlug: {}, missing: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const wanted = key === "" ? [] : key.split(",");
    setState((s) => ({ ...s, status: "loading", error: null }));
    Promise.all(wanted.map((slug) => getCoin(slug).then((coin) => [slug, coin] as const)))
      .then((pairs) => {
        if (cancelled) return;
        const bySlug: Record<string, Coin> = {};
        const missing: string[] = [];
        for (const [slug, coin] of pairs) {
          if (coin) bySlug[slug] = coin;
          else missing.push(slug);
        }
        setState({ key, status: "ready", error: null, bySlug, missing });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, key, status: "error", error: cause instanceof Error ? cause.message : String(cause) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);

  // A lookup for a different set of slugs than the one that answered is still loading.
  const stale = state.key !== key;
  return {
    status: stale ? "loading" : state.status,
    error: stale ? null : state.error,
    bySlug: state.bySlug,
    missing: stale ? [] : state.missing,
    retry: () => setAttempt((n) => n + 1),
  };
}
