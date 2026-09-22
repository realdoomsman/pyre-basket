import type { Coin } from "./coins";
import type { Basket, BasketToken } from "../types";

/** One leg in the builder: a coin picked from the universe plus its weight. */
export interface DraftRow extends BasketToken {
  key: number;
}

export interface Draft {
  title: string;
  description: string;
  rationale: string;
  tags: string;
  rows: DraftRow[];
  editId: string | null;
}

let nextKey = 1;

export function rowFromCoin(coin: Coin, weight: number): DraftRow {
  return { key: nextKey++, slug: coin.slug, ticker: coin.ticker, name: coin.name, tokenAddress: coin.tokenAddress, weight };
}

export function emptyDraft(): Draft {
  return { title: "", description: "", rationale: "", tags: "", rows: [], editId: null };
}

export function draftFromBasket(basket: Basket, mode: "edit" | "remix"): Draft {
  return {
    title: mode === "edit" ? basket.title : `${basket.title} remix`.slice(0, 60),
    description: basket.description,
    rationale: basket.rationale,
    tags: basket.tags.filter((t) => t !== "auto").join(", "),
    rows: basket.tokens.map((t) => ({ key: nextKey++, ...t })),
    editId: mode === "edit" ? basket.id : null,
  };
}

/* In-memory hand-off from a detail page ("Remix") to the builder. Storage APIs are off limits. */
let pending: Draft | null = null;

export function stashDraft(draft: Draft): void {
  pending = draft;
}

export function takeDraft(): Draft | null {
  const draft = pending;
  pending = null;
  return draft;
}
