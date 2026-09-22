/** Shapes returned by `functions/*.js`. Keep in sync with the JSDoc there. */

/** One leg of a basket: a coin launched on Pyre, keyed by its slug, plus an integer weight. */
export interface BasketToken {
  slug: string;
  ticker: string;
  name: string;
  tokenAddress: string;
  /** Integer percent, 1–100. Every basket's weights total exactly 100. */
  weight: number;
}

export interface Basket {
  id: string;
  title: string;
  description: string;
  rationale: string;
  tags: string[];
  tokens: BasketToken[];
  creatorId: string | null;
  creatorName: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  /** Derived from the coin universe on the client, never stored. */
  auto: boolean;
  /** True when the caller owns it. */
  mine: boolean;
}

export interface BasketCard {
  id: string;
  title: string;
  blurb: string;
  tags: string[];
  tokens: { slug: string; ticker: string; weight: number }[];
  creatorName: string;
  featured: boolean;
  auto: boolean;
  createdAt: string;
}

export type GallerySort = "newest" | "featured" | "24h";

export interface GalleryQuery {
  q: string;
  tag: string;
  sort: GallerySort;
}

export interface GalleryResult {
  items: BasketCard[];
  total: number;
  tags: string[];
}

export interface BasketResult {
  basket: Basket | null;
  error?: string;
}

export interface MineResult {
  ok: boolean;
  reason?: "auth";
  baskets: Basket[];
  freeLimit: number;
  unlimited: boolean;
  isHolder: boolean;
  /** Baskets left on the free tier; `null` when unlimited. */
  remaining: number | null;
}

export interface PublishInput {
  id?: string;
  title: string;
  description: string;
  rationale: string;
  tags: string[];
  tokens: BasketToken[];
  creatorName: string;
}

export interface PublishResult {
  ok: boolean;
  reason?: "auth" | "invalid" | "limit" | "missing";
  error?: string;
  basket?: Basket;
  count?: number;
  freeLimit?: number;
  unlimited?: boolean;
}

export interface RemoveResult {
  ok: boolean;
  reason?: "auth" | "invalid" | "owner";
  error?: string;
  id?: string;
}

export interface AssistResult {
  ok: boolean;
  reason?: "auth" | "holder" | "invalid" | "rate" | "llm";
  error?: string;
  title?: string;
  description?: string;
  rationale?: string;
  weights?: { ticker: string; weight: number }[];
  runsLeft?: number;
}
