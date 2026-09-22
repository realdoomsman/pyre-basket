import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink, Card, Chip, CoinAvatar, Delta, Donut, EmptyState, Input, LineChart, PageHeader, Skeleton, Stat, cx, useToast } from "../components";
import { api } from "../lib/api";
import { autoBaskets, isAutoId } from "../lib/autoBaskets";
import { dataSource, getCandles, tradeUrl, useCoinsFor, useUniverse, type Candle, type Coin } from "../lib/coins";
import { draftFromBasket, stashDraft } from "../lib/draft";
import { errorMessage, pct, priceUsd, qty, relativeDate, usdCents, usdCompact } from "../lib/format";
import { editHref, galleryHref, navigate } from "../lib/route";
import { equityCurve, sizeLegs, totalMarketCap, weighted24h, type Weighted24h } from "../lib/stats";
import { useAsync } from "../lib/useAsync";
import { heatByRank } from "../lib/weights";
import type { Basket } from "../types";

const PRESETS = [50, 100, 250, 1000];
const MAX_BUDGET = 1_000_000_000;

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading basket" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-24" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export function Detail({ id }: { id: string }) {
  if (isAutoId(id)) return <AutoDetail id={id} />;
  return <StoredDetail id={id} />;
}

function AutoDetail({ id }: { id: string }) {
  const universe = useUniverse();
  if (universe.status === "loading") return <DetailSkeleton />;
  if (universe.status === "error") {
    return (
      <EmptyState
        action={<Button onClick={universe.retry}>Try again</Button>}
        description={universe.error}
        role="alert"
        title="Live coin data did not load"
      />
    );
  }
  const basket = autoBaskets(universe.trending, universe.fresh).find((b) => b.id === id) ?? null;
  if (!basket) return <NotFound reason="Pyre does not list enough coins to build this one right now." />;
  return <BasketView basket={basket} />;
}

function StoredDetail({ id }: { id: string }) {
  const result = useAsync(() => api.basket(id), [id]);
  if (result.status === "loading" && !result.data) return <DetailSkeleton />;
  if (result.status === "error" && !result.data) {
    return (
      <EmptyState
        action={
          <div className="flex gap-2">
            <Button onClick={result.retry}>Try again</Button>
            <ButtonLink href="#/" variant="secondary">
              Back to gallery
            </ButtonLink>
          </div>
        }
        description={result.error}
        role="alert"
        title="This basket did not load"
      />
    );
  }
  const basket = result.data?.basket ?? null;
  if (!basket) return <NotFound reason={result.data?.error ?? "It may have been deleted, or the link is wrong."} />;
  return <BasketView basket={basket} />;
}

function NotFound({ reason }: { reason: string }) {
  return (
    <EmptyState
      action={
        <ButtonLink href="#/" variant="secondary">
          Back to gallery
        </ButtonLink>
      }
      description={reason}
      title="No basket here"
    />
  );
}

/* ---- The basket ------------------------------------------------------------------------- */

/** One line under the 24h figure: what share it covers and how much of it is measured since launch. */
function change24hNote(change: Weighted24h): string {
  if (change.pct === null) return "no usable figure yet";
  const parts: string[] = [];
  if (change.coverage < 0.999) parts.push(`covers ${Math.round(change.coverage * 100)}% of the basket`);
  if (change.sinceLaunch >= 0.999) parts.push("all legs launched today: since launch");
  else if (change.sinceLaunch > 0) parts.push(`${Math.round(change.sinceLaunch * 100)}% of weight launched today, counted since launch`);
  return parts.length > 0 ? parts.join(" · ") : "weighted by allocation";
}

function parseBudget(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text.replace(/[,$\s]/g, ""));
  return Number.isFinite(value) && value >= 0 ? Math.min(value, MAX_BUDGET) : null;
}

interface CandleState {
  status: "loading" | "ready" | "error";
  bySlug: Record<string, Candle[]>;
  error: string | null;
}

function useCandles(slugs: string[]): CandleState & { retry: () => void } {
  const key = slugs.join(",");
  const [state, setState] = useState<CandleState>({ status: "loading", bySlug: {}, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", bySlug: {}, error: null });
    Promise.all(key.split(",").map((slug) => getCandles(slug).then((candles) => [slug, candles] as const)))
      .then((pairs) => {
        if (cancelled) return;
        const bySlug: Record<string, Candle[]> = {};
        for (const [slug, candles] of pairs) bySlug[slug] = candles;
        setState({ status: "ready", bySlug, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setState({ status: "error", bySlug: {}, error: cause instanceof Error ? cause.message : String(cause) });
      });
    return () => {
      cancelled = true;
    };
  }, [key, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

function BasketView({ basket }: { basket: Basket }) {
  const { toast } = useToast();
  const [hover, setHover] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [text, setText] = useState("100");

  const slugs = useMemo(() => basket.tokens.map((t) => t.slug), [basket.tokens]);
  const coins = useCoinsFor(slugs);
  const candles = useCandles(slugs);
  const bySlug = coins.bySlug;
  const pricing = coins.status === "loading";

  const colours = heatByRank(basket.tokens.map((t) => t.weight));
  const largest = basket.tokens.reduce<(typeof basket.tokens)[number] | null>((a, b) => (a === null || b.weight > a.weight ? b : a), null);
  const change = weighted24h(basket.tokens, bySlug);
  const mcap = totalMarketCap(basket.tokens, bySlug);
  const curve = useMemo(() => equityCurve(basket.tokens, candles.bySlug), [basket.tokens, candles.bySlug]);
  const budget = parseBudget(text);
  const invalid = text.trim() !== "" && budget === null;
  const budgetCents = Math.round((budget ?? 0) * 100);
  const sizing = sizeLegs(budgetCents, basket.tokens, bySlug);
  const totalCents = sizing.reduce((acc, s) => acc + s.cents, 0);
  const valueAfter24h = change.pct === null ? null : totalCents * (1 + change.pct / 100);
  const example = dataSource() === "example";

  const share = async (): Promise<void> => {
    const url = `${window.location.origin}${window.location.pathname}#/b/${encodeURIComponent(basket.id)}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: basket.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      toast("Could not share. Copy the address bar instead.", "error");
    }
  };

  const copyList = async (): Promise<void> => {
    const lines = [
      `${basket.title} — ${usdCents(totalCents)}`,
      ...sizing.map((s) => `${s.ticker.padEnd(8)} ${String(s.weight).padStart(3)}%  ${usdCents(s.cents).padStart(12)}  ${tradeUrl(s.slug)}`),
      "",
      "Dollar amounts are the budget split by weight. Buy each leg on Pyre. Not financial advice.",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast("Shopping list copied");
    } catch {
      toast("Could not copy. Select the list and copy it by hand.", "error");
    }
  };

  const remix = (): void => {
    stashDraft(draftFromBasket(basket, "remix"));
    navigate("#/new");
  };

  const remove = async (): Promise<void> => {
    setRemoving(true);
    try {
      const res = await api.remove(basket.id);
      if (!res.ok) {
        toast(res.error ?? "Could not delete that basket.", "error");
        return;
      }
      toast("Basket deleted");
      navigate("#/mine");
    } catch (cause) {
      toast(errorMessage(cause), "error");
    } finally {
      setRemoving(false);
      setConfirm(false);
    }
  };

  const eyebrow = basket.auto
    ? example
      ? "auto basket · example data"
      : "auto basket · rebuilt from live data"
    : `by ${basket.creatorName} · ${relativeDate(basket.createdAt)}${basket.updatedAt !== basket.createdAt ? ` · edited ${relativeDate(basket.updatedAt)}` : ""}`;

  return (
    <article className="rise flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <a className="text-sm text-ink-faint hover:text-ink" href="#/">
          Back to gallery
        </a>
        <PageHeader
          actions={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void share()}>Share link</Button>
              <Button onClick={remix} variant="secondary">
                Remix
              </Button>
              {basket.mine ? (
                <>
                  <ButtonLink href={editHref(basket.id)} variant="secondary">
                    Edit
                  </ButtonLink>
                  {confirm ? (
                    <span className="flex items-center gap-2 text-sm text-ink-muted">
                      Delete for good?
                      <Button disabled={removing} onClick={() => void remove()} size="sm" variant="secondary">
                        {removing ? "Deleting…" : "Yes, delete"}
                      </Button>
                      <Button onClick={() => setConfirm(false)} size="sm" variant="ghost">
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <Button onClick={() => setConfirm(true)} variant="ghost">
                      Delete
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          }
          description={basket.description}
          eyebrow={eyebrow}
          title={<span data-testid="basket-title">{basket.title}</span>}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {basket.auto ? <Chip>auto</Chip> : null}
          {basket.featured ? <Chip tone="violet">featured</Chip> : null}
          {basket.mine ? <Chip>yours</Chip> : null}
          {basket.tags.map((tag) => (
            <a key={tag} className="inline-flex h-6 items-center rounded-md border border-border bg-surface px-2 font-mono text-xs text-ink-muted hover:border-border-strong hover:text-ink" href={galleryHref({ tag })}>
              #{tag}
            </a>
          ))}
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="24h" note={change24hNote(change)}>
            {pricing ? <Skeleton className="h-6 w-20" /> : <Delta coverage={change.coverage} sinceLaunch={change.sinceLaunch >= 0.999} value={change.pct} />}
          </Stat>
          <Stat label="7 days" note={curve.points.length > 1 ? (curve.coverage < 0.999 ? `covers ${Math.round(curve.coverage * 100)}% of the basket` : "hourly closes, rebased") : "no history yet"}>
            {candles.status === "loading" ? <Skeleton className="h-6 w-20" /> : <Delta value={curve.changePct} />}
          </Stat>
          <Stat label="combined mcap" note={coins.missing.length > 0 ? `${coins.missing.length} leg${coins.missing.length === 1 ? "" : "s"} unpriced` : "sum of the legs"}>
            {pricing ? <Skeleton className="h-6 w-24" /> : mcap > 0 ? usdCompact(mcap) : "—"}
          </Stat>
          <Stat label="legs" note={largest ? `${largest.ticker} is the largest at ${largest.weight}%` : ""}>
            {basket.tokens.length}
          </Stat>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <Card
            actions={<Chip>{example ? "example data" : "hourly · 7d"}</Chip>}
            description="What 100 put into this basket a week ago would be worth, hour by hour, from each leg's closes."
            title="Equity curve"
          >
            {candles.status === "loading" ? (
              <Skeleton className="h-44" />
            ) : candles.status === "error" ? (
              <EmptyState
                action={
                  <Button onClick={candles.retry} variant="secondary">
                    Try again
                  </Button>
                }
                description={candles.error}
                title="No price history"
              />
            ) : curve.points.length < 2 ? (
              <EmptyState description="Pyre has no hourly history for these legs yet." title="No price history" />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between font-mono text-xs tabular-nums text-ink-faint">
                  <span>{new Date(curve.points[0]?.t ?? 0).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <span className="text-ink">
                    {(curve.points[curve.points.length - 1]?.value ?? 100).toFixed(1)} <span className="text-ink-faint">now</span>
                  </span>
                </div>
                <LineChart label={`Equity curve over ${curve.points.length} hours: ${pct(curve.changePct)}`} points={curve.points} />
                {curve.coverage < 0.999 ? <p className="text-xs text-ink-faint">Legs without history are left out; the curve covers {Math.round(curve.coverage * 100)}% of the basket.</p> : null}
              </div>
            )}
          </Card>

          <Card
            actions={
              <Button disabled={budget === null || budget === 0} onClick={() => void copyList()} size="sm" variant="secondary">
                Copy list
              </Button>
            }
            description="Your budget split by weight, rounded to the cent so it always adds up, then sized at each leg's live price. Buying happens on Pyre; this app holds no funds."
            title="Shopping list"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  className="sm:w-48"
                  error={invalid ? "Enter a dollar amount." : undefined}
                  inputMode="decimal"
                  label="Your budget (USD)"
                  onChange={(e) => setText(e.target.value)}
                  placeholder="100"
                  type="text"
                  value={text}
                />
                <div aria-label="Quick amounts" className="flex flex-wrap gap-1.5 pb-0.5" role="group">
                  {PRESETS.map((p) => (
                    <Button key={p} className="font-mono" onClick={() => setText(String(p))} size="sm" variant={budget === p ? "primary" : "secondary"}>
                      ${p.toLocaleString("en-US")}
                    </Button>
                  ))}
                </div>
              </div>

              <ol aria-label="Legs" className="flex flex-col divide-y divide-border">
                {sizing.map((row, i) => {
                  const coin: Coin | undefined = bySlug[row.slug];
                  const token = basket.tokens[i];
                  return (
                    <li
                      key={row.slug}
                      className={cx("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 transition-colors sm:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]", hover === i && "bg-surface-raised")}
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <CoinAvatar imageUrl={coin?.imageUrl ?? ""} ticker={row.ticker} />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-sm text-ink">{row.ticker}</span>
                          <span className="truncate text-xs text-ink-faint">{coin?.name ?? token?.name ?? ""}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1 w-24 overflow-hidden rounded-full bg-border">
                            <div className="h-full rounded-full" style={{ width: `${row.weight}%`, background: colours[i] }} />
                          </div>
                          <span className="font-mono text-xs tabular-nums text-ink-muted">{row.weight}%</span>
                        </div>
                      </div>
                      <div className="col-start-2 row-start-2 flex items-baseline gap-3 font-mono text-xs tabular-nums sm:col-auto sm:row-auto sm:flex-col sm:items-start sm:gap-0.5">
                        {pricing ? (
                          <Skeleton className="h-4 w-20" />
                        ) : coin ? (
                          <>
                            <span className="text-ink">{priceUsd(coin.priceUsd)}</span>
                            <Delta sinceLaunch={coin.young} value={coin.change24hPct} />
                          </>
                        ) : (
                          <span className="text-ink-faint">unpriced on Pyre</span>
                        )}
                      </div>
                      <div className="col-start-3 row-start-1 flex flex-col items-end gap-0.5 font-mono text-sm tabular-nums sm:col-auto sm:row-auto">
                        <span className="text-ink" data-testid={`split-${row.ticker}`}>
                          {usdCents(row.cents)}
                        </span>
                        <span className="text-xs text-ink-faint">{row.tokens === null ? "—" : `≈ ${qty(row.tokens)} ${row.ticker}`}</span>
                      </div>
                      <a className="col-start-3 row-start-2 justify-self-end text-xs text-violet hover:underline sm:col-auto sm:row-auto" href={tradeUrl(row.slug)} rel="noopener noreferrer" target="_blank">
                        Trade on Pyre
                      </a>
                    </li>
                  );
                })}
                <li className="flex items-center justify-between pt-3 text-sm">
                  <span className="text-ink-muted">Adds up to</span>
                  <span className="font-mono tabular-nums font-medium text-ink" data-testid="split-total">
                    {usdCents(totalCents)}
                  </span>
                </li>
              </ol>

              <p className="text-sm text-ink-muted">
                {valueAfter24h === null || totalCents === 0
                  ? "No 24h figure for this basket yet."
                  : `${usdCents(totalCents)} put in ${change.sinceLaunch >= 0.999 ? "at launch" : "a day ago"} would be ${usdCents(Math.round(valueAfter24h))} now, from the weighted move${change.coverage < 0.999 ? ` (covers ${Math.round(change.coverage * 100)}% of the basket)` : ""}.`}
              </p>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Weights">
            <div className="flex flex-col items-center gap-5">
              <Donut highlight={hover} size={200} slices={basket.tokens} thickness={28}>
                <div>
                  <div className="font-mono text-2xl tabular-nums text-ink">{basket.tokens[hover ?? 0]?.weight ?? 0}%</div>
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">{basket.tokens[hover ?? 0]?.ticker ?? ""}</div>
                </div>
              </Donut>
              <ul className="flex w-full flex-col">
                {basket.tokens.map((t, i) => (
                  <li key={t.slug} className={cx("flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-sm", hover === i && "bg-surface-raised")} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ background: colours[i] }} />
                    <span className="text-ink">{t.ticker}</span>
                    <span className="ml-auto tabular-nums text-ink-muted">{t.weight}%</span>
                  </li>
                ))}
              </ul>
            </div>
            {basket.rationale ? (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">why these weights</p>
                <p className="text-sm text-ink-muted">{basket.rationale}</p>
              </div>
            ) : null}
          </Card>
          {coins.status === "error" ? (
            <p className="text-sm text-danger" role="alert">
              Live coin data did not load: {coins.error}{" "}
              <button className="underline" onClick={coins.retry} type="button">
                Try again
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
