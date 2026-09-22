import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ship } from "@pyre/app-sdk";
import { errorMessage, relativeDate, seriesColor, tagFromHash, tagHref } from "../lib";
import { btnGhost, btnPrimary, chip, input, panel } from "../ui";
import type { BasketCard, GalleryResult } from "../types";

function WeightStrip({ tokens }: { tokens: { ticker: string; weight: number }[] }) {
  const sorted = [...tokens].sort((a, b) => b.weight - a.weight).slice(0, 8);
  const total = sorted.reduce((acc, t) => acc + t.weight, 0) || 100;
  return (
    <div aria-hidden="true" className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
      {sorted.map((t, i) => (
        <span
          className="h-full rounded-[2px]"
          key={t.ticker}
          style={{ backgroundColor: seriesColor(i), width: `${(t.weight / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function Card({ basket }: { basket: BasketCard }) {
  const top = [...basket.tokens].sort((a, b) => b.weight - a.weight);
  const shown = top.slice(0, 4);
  return (
    <li className="group relative flex flex-col gap-3 rounded-2xl border border-edge/70 bg-panel/70 p-4 transition hover:border-accent/70">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-tight">
          <a className="rounded outline-none hover:underline" href={`#/b/${basket.id}`}>
            {basket.title}
            <span className="absolute inset-0" />
          </a>
        </h3>
        {basket.featured ? (
          <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
            Featured
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 text-sm text-ink-faint">{basket.blurb}</p>
      <WeightStrip tokens={basket.tokens} />
      <ul className="flex flex-wrap gap-1.5 text-xs">
        {shown.map((t) => (
          <li className="rounded-md bg-panel-2 px-1.5 py-0.5 font-mono tabular-nums text-ink-dim" key={t.ticker}>
            {t.ticker} {t.weight}%
          </li>
        ))}
        {top.length > shown.length ? (
          <li className="px-1 py-0.5 text-ink-faint">+{top.length - shown.length} more</li>
        ) : null}
      </ul>
      <p className="mt-auto flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
        <span>by {basket.creatorName}</span>
        <span aria-hidden="true">·</span>
        <span>{relativeDate(basket.createdAt)}</span>
      </p>
      {basket.tags.length > 0 ? (
        <ul className="relative z-10 flex flex-wrap gap-1.5">
          {basket.tags.map((t) => (
            <li key={t}>
              <a className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline" href={tagHref(t)}>
                #{t}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function Gallery() {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState(() => tagFromHash(window.location.hash));
  const [sort, setSort] = useState<"newest" | "featured">("newest");
  const [data, setData] = useState<GalleryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const debounced = useRef(query);

  // A tag chip elsewhere in the app links to `#/?tag=...`; keep the filter and the URL in sync.
  useEffect(() => {
    const onHashChange = (): void => setTag(tagFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goToTag = (next: string): void => {
    window.location.hash = tagHref(next);
    setTag(next);
  };

  const load = useCallback(async (q: string, t: string, s: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setData(await ship.fn<GalleryResult>("gallery", { q, tag: t, sort: s }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      debounced.current = query;
      void load(query, tag, sort);
    }, query === debounced.current ? 0 : 280);
    return () => window.clearTimeout(handle);
  }, [query, tag, sort, reloadKey, load]);

  return (
    <section aria-labelledby="gallery-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold" id="gallery-heading">
          Public baskets
        </h2>
        <p className="text-sm text-ink-faint">
          Weighted memecoin lists built by other people. Open one to get a dollar-by-dollar shopping list.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-ink-dim" htmlFor={searchId}>
              Search by coin, tag or title
            </label>
            <input
              className={`${input} mt-1`}
              id={searchId}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="DOGE, dogs, equal weight…"
              type="search"
              value={query}
            />
          </div>
          <div className="flex gap-2" role="group" aria-label="Sort baskets">
            <button
              aria-pressed={sort === "newest"}
              className={sort === "newest" ? btnPrimary : btnGhost}
              onClick={() => setSort("newest")}
              type="button"
            >
              Newest
            </button>
            <button
              aria-pressed={sort === "featured"}
              className={sort === "featured" ? btnPrimary : btnGhost}
              onClick={() => setSort("featured")}
              type="button"
            >
              Featured
            </button>
          </div>
        </div>

        {data && data.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Filter by tag">
            <li>
              <button
                aria-pressed={tag === ""}
                className={`${chip} ${tag === "" ? "border-accent text-ink" : ""}`}
                onClick={() => goToTag("")}
                type="button"
              >
                All
              </button>
            </li>
            {data.tags.map((t) => (
              <li key={t}>
                <button
                  aria-pressed={tag === t}
                  className={`${chip} ${tag === t ? "border-accent text-ink" : ""}`}
                  onClick={() => goToTag(t === tag ? "" : t)}
                  type="button"
                >
                  #{t}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <div className={`${panel} border-danger/50`} role="alert">
          <p className="text-sm text-ink">Could not load the gallery. {error}</p>
          <button className={`${btnGhost} mt-3`} onClick={() => setReloadKey((k) => k + 1)} type="button">
            Try again
          </button>
        </div>
      ) : null}

      {loading && data === null && !error ? (
        <ul className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li className="h-44 animate-pulse rounded-2xl border border-edge/50 bg-panel/40" key={i} />
          ))}
        </ul>
      ) : null}

      {data !== null && !error ? (
        data.items.length === 0 ? (
          <div className={panel}>
            <p className="text-sm text-ink-dim">
              No baskets match {query !== "" ? `“${query}”` : "that filter"}
              {tag !== "" ? ` in #${tag}` : ""}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={btnGhost}
                onClick={() => {
                  setQuery("");
                  goToTag("");
                }}
                type="button"
              >
                Clear filters
              </button>
              <a className={btnPrimary} href="#/new">
                Build this basket yourself
              </a>
            </div>
          </div>
        ) : (
          <>
            <p aria-live="polite" className="text-xs text-ink-faint">
              {data.total} basket{data.total === 1 ? "" : "s"}
              {loading ? " · updating…" : ""}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2" data-testid="gallery-list">
              {data.items.map((b) => (
                <Card basket={b} key={b.id} />
              ))}
            </ul>
          </>
        )
      ) : null}
    </section>
  );
}
