import { useCallback, useEffect, useState } from "react";
import { ship } from "@pyre/app-sdk";
import { errorMessage, relativeDate } from "../lib";
import { btnGhost, btnPrimary, chip, panel } from "../ui";
import { draftFromBasket, setDraft } from "../draft";
import SplitCalculator from "./SplitCalculator";
import WeightBreakdown from "./WeightBreakdown";
import type { Basket, BasketResult } from "../types";

export default function Detail({ id }: { id: string }) {
  const [basket, setBasket] = useState<Basket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await ship.fn<BasketResult>("basket", { id });
      if (result.basket === null) setError(result.error ?? "This basket could not be found.");
      else setBasket(result.basket);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-panel" />
        <div className="h-44 animate-pulse rounded-2xl bg-panel/60" />
        <div className="h-60 animate-pulse rounded-2xl bg-panel/60" />
      </div>
    );
  }

  if (error !== null || basket === null) {
    return (
      <div className={panel} role="alert">
        <h2 className="text-lg font-semibold">Basket unavailable</h2>
        <p className="mt-2 text-sm text-ink-dim">{error ?? "This basket could not be found."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnGhost} onClick={() => setReloadKey((k) => k + 1)} type="button">
            Try again
          </button>
          <a className={btnGhost} href="#/">
            Back to the gallery
          </a>
        </div>
      </div>
    );
  }

  const remix = (): void => {
    setDraft(draftFromBasket(basket, { edit: false }));
    window.location.hash = "#/new";
  };

  const edit = (): void => {
    setDraft(draftFromBasket(basket, { edit: true }));
    window.location.hash = `#/edit/${basket.id}`;
  };

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <a className="text-sm text-ink-faint hover:text-ink" href="#/">
          ← All baskets
        </a>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight" data-testid="basket-title">
            {basket.title}
          </h2>
          {basket.featured ? (
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">Featured</span>
          ) : null}
        </div>
        <p className="text-xs text-ink-faint">
          by {basket.creatorName} · published {relativeDate(basket.createdAt)} · {basket.tokens.length} coins
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">{basket.description}</p>
        {basket.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {basket.tags.map((t) => (
              <li key={t}>
                <a className={`${chip} hover:border-accent`} href="#/">
                  #{t}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <section aria-labelledby="weights-heading" className={panel}>
        <h3 className="text-lg font-semibold" id="weights-heading">
          Weights
        </h3>
        <div className="mt-4">
          <WeightBreakdown caption={basket.rationale} tokens={basket.tokens} />
        </div>
      </section>

      <section aria-labelledby="buy-heading" className={panel}>
        <h3 className="text-lg font-semibold" id="buy-heading">
          How to buy this basket
        </h3>
        <p className="mt-1 text-sm text-ink-faint">
          Pick a budget and Basket splits it by weight. Execute the buys yourself on Robinhood Chain or any exchange
          that lists these coins.
        </p>
        <div className="mt-4">
          <SplitCalculator tokens={basket.tokens} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={remix} type="button">
          Remix into my own basket
        </button>
        {basket.mine ? (
          <button className={btnGhost} onClick={edit} type="button">
            Edit this basket
          </button>
        ) : null}
        <a className={btnGhost} href="#/mine">
          My baskets
        </a>
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Not an ETF, not a fund and not financial advice. Nobody verifies that a ticker in a basket is the coin you
        think it is — check the contract address yourself before buying.
      </p>
    </article>
  );
}
