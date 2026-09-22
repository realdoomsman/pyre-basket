import { pyreEnv } from "@pyre/app-sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { BasketCardView, Button, ButtonLink, CardSkeleton, EmptyState, Input, PageHeader, Tabs, cx } from "../components";
import { api } from "../lib/api";
import { autoBaskets, cardOf } from "../lib/autoBaskets";
import { useCoinsFor, useUniverse, type Coin } from "../lib/coins";
import { galleryHref, navigate, replaceHash } from "../lib/route";
import { weighted24h } from "../lib/stats";
import { useAsync } from "../lib/useAsync";
import type { BasketCard, GalleryQuery, GallerySort } from "../types";

const SORTS: { value: GallerySort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "featured", label: "Featured" },
  { value: "24h", label: "24h" },
];

function matches(card: BasketCard, needle: string, bySlug: Record<string, Coin>): boolean {
  if (needle === "") return true;
  const hay = [card.title, card.blurb, card.creatorName, ...card.tags, ...card.tokens.flatMap((t) => [t.ticker, bySlug[t.slug]?.name ?? ""])]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function Gallery({ query }: { query: GalleryQuery }) {
  const env = pyreEnv();
  const catalog = useAsync(() => api.gallery(), []);
  const universe = useUniverse();

  const published = useMemo(() => catalog.data?.items ?? [], [catalog.data]);
  const auto = useMemo(() => (universe.status === "ready" ? autoBaskets(universe.trending, universe.fresh).map(cardOf) : []), [universe.status, universe.trending, universe.fresh]);

  // Coins the published baskets reference that the trending/new lists do not carry.
  const extra = useMemo(() => {
    if (universe.status !== "ready") return [];
    const wanted: Record<string, true> = {};
    for (const card of published) for (const t of card.tokens) if (!universe.bySlug[t.slug]) wanted[t.slug] = true;
    return Object.keys(wanted);
  }, [published, universe.status, universe.bySlug]);
  const lookup = useCoinsFor(extra);
  const bySlug = useMemo(() => ({ ...universe.bySlug, ...lookup.bySlug }), [universe.bySlug, lookup.bySlug]);
  const pricing = universe.status === "loading" || (extra.length > 0 && lookup.status === "loading");

  const [text, setText] = useState(query.q);
  const debounce = useRef<number>(0);
  useEffect(() => setText(query.q), [query.q]);
  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const update = (patch: Partial<GalleryQuery>, replace = false): void => {
    const href = galleryHref({ ...query, ...patch });
    if (replace) replaceHash(href);
    else navigate(href);
  };
  const onSearch = (value: string): void => {
    setText(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => update({ q: value.trim() }, true), 180);
  };

  const all = useMemo(() => [...published, ...auto], [published, auto]);
  const tags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of all) for (const tag of card.tags) counts[tag] = (counts[tag] ?? 0) + 1;
    return Object.keys(counts)
      .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b))
      .slice(0, 16);
  }, [all]);

  const needle = query.q.toLowerCase();
  const items = useMemo(() => {
    const list = all.filter((card) => (query.tag === "" || card.tags.includes(query.tag)) && matches(card, needle, bySlug));
    const byNewest = (a: BasketCard, b: BasketCard): number => Number(b.auto) - Number(a.auto) || b.createdAt.localeCompare(a.createdAt);
    if (query.sort === "featured") list.sort((a, b) => Number(b.featured) - Number(a.featured) || byNewest(a, b));
    else if (query.sort === "24h") {
      const score = (c: BasketCard): number => weighted24h(c.tokens, bySlug).pct ?? Number.NEGATIVE_INFINITY;
      list.sort((a, b) => score(b) - score(a) || byNewest(a, b));
    } else list.sort((a, b) => Number(a.auto) - Number(b.auto) || b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [all, query.tag, query.sort, needle, bySlug]);

  const filtered = query.q !== "" || query.tag !== "";
  const loading = catalog.status === "loading" || universe.status === "loading";
  const failed = catalog.status === "error" && universe.status === "error";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        actions={<ButtonLink href="#/new">Build a basket</ButtonLink>}
        description="Weighted lists of coins launched on Pyre. Pick the legs, set the split, get the exact dollar sizing for any budget, and buy each leg on Pyre."
        eyebrow={env.ticker ? `$${env.ticker}` : "pyre app"}
        title={env.name ?? "Basket"}
      />

      <section aria-label="Filters" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            aria-label="Search by coin, tag or title"
            autoComplete="off"
            className="flex-1"
            enterKeyHint="search"
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by coin, tag or title"
            type="search"
            value={text}
          />
          <Tabs label="Sort" onChange={(sort) => update({ sort })} options={SORTS} value={query.sort} />
        </div>
        {tags.length > 0 ? (
          <div aria-label="Tags" className="flex flex-wrap gap-1.5" role="group">
            <Button aria-pressed={query.tag === ""} onClick={() => update({ tag: "" })} size="sm" variant={query.tag === "" ? "primary" : "secondary"}>
              All
            </Button>
            {tags.map((tag) => (
              <Button key={tag} aria-pressed={query.tag === tag} className="font-mono" onClick={() => update({ tag: query.tag === tag ? "" : tag })} size="sm" variant={query.tag === tag ? "primary" : "secondary"}>
                #{tag}
              </Button>
            ))}
          </div>
        ) : null}
      </section>

      <section aria-label="Baskets" className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm text-ink-faint">
          <p aria-live="polite">{loading && items.length === 0 ? "Loading…" : `${items.length} basket${items.length === 1 ? "" : "s"}${filtered ? " match" : ""}`}</p>
          {filtered ? (
            <Button onClick={() => navigate("#/")} size="sm" variant="ghost">
              Clear filters
            </Button>
          ) : null}
        </div>

        {failed && items.length === 0 ? (
          <EmptyState
            action={
              <Button
                onClick={() => {
                  catalog.retry();
                  universe.retry();
                }}
              >
                Try again
              </Button>
            }
            description={catalog.error}
            role="alert"
            title="The gallery did not load"
          />
        ) : loading && items.length === 0 ? (
          <div aria-busy="true" aria-label="Loading baskets" className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            action={filtered ? <Button onClick={() => navigate("#/")}>Show everything</Button> : <ButtonLink href="#/new">Build a basket</ButtonLink>}
            description={filtered ? "Try another coin, tag or title." : "Nothing published yet, and Pyre has no coins to build from."}
            title={filtered ? "Nothing matches" : "No baskets yet"}
          />
        ) : (
          <ul className={cx("grid gap-4 md:grid-cols-2", loading && "opacity-70")} data-testid="gallery-list">
            {items.map((card) => (
              <BasketCardView key={card.id} bySlug={bySlug} card={card} pricing={pricing} />
            ))}
          </ul>
        )}
        {catalog.status === "error" && !failed ? (
          <p className="text-sm text-danger" role="alert">
            Published baskets did not load: {catalog.error}{" "}
            <button className="underline" onClick={catalog.retry} type="button">
              Try again
            </button>
          </p>
        ) : null}
        {universe.status === "error" && !failed ? (
          <p className="text-sm text-danger" role="alert">
            Live coin data did not load, so 24h and market cap are blank: {universe.error}{" "}
            <button className="underline" onClick={universe.retry} type="button">
              Try again
            </button>
          </p>
        ) : null}
      </section>
    </div>
  );
}
