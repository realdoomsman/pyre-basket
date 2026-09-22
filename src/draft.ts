import type { Basket } from "./types";

/** Hand-off between "remix this basket" on a detail page and the builder route. */
export interface Draft {
  title: string;
  description: string;
  rationale: string;
  tags: string;
  tokens: { ticker: string; name: string; weight: string }[];
  editId?: string;
}

let pending: Draft | null = null;

export function setDraft(draft: Draft | null): void {
  pending = draft;
}

export function takeDraft(): Draft | null {
  const draft = pending;
  pending = null;
  return draft;
}

export function draftFromBasket(basket: Basket, opts: { edit: boolean }): Draft {
  return {
    title: opts.edit ? basket.title : `${basket.title} remix`.slice(0, 60),
    description: basket.description,
    rationale: basket.rationale ?? "",
    tags: basket.tags.join(", "),
    tokens: basket.tokens.map((t) => ({ ticker: t.ticker, name: t.name ?? "", weight: String(t.weight) })),
    ...(opts.edit ? { editId: basket.id } : {}),
  };
}
