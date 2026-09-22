/** Shapes returned by `functions/*.js`. */

export interface TokenWeight {
  ticker: string;
  name?: string;
  weight: number;
}

export interface Basket {
  id: string;
  title: string;
  description: string;
  rationale?: string;
  tags: string[];
  tokens: TokenWeight[];
  creatorId: string | null;
  creatorName: string;
  featured: boolean;
  createdAt: string;
  updatedAt?: string;
  demo?: boolean;
  mine?: boolean;
}

export interface BasketCard {
  id: string;
  title: string;
  blurb: string;
  tags: string[];
  tokens: { ticker: string; weight: number }[];
  creatorName: string;
  featured: boolean;
  createdAt: string;
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
  reason?: string;
  baskets: Basket[];
  freeLimit: number;
  unlimited: boolean;
  paid?: boolean;
  isHolder?: boolean;
  remaining?: number | null;
}

export interface PublishResult {
  ok: boolean;
  reason?: "auth" | "invalid" | "limit";
  error?: string;
  basket?: Basket;
  count?: number;
  unlimited?: boolean;
}

export interface AssistResult {
  ok: boolean;
  reason?: "auth" | "locked" | "invalid" | "rate" | "llm";
  error?: string;
  title?: string;
  description?: string;
  rationale?: string;
  weights?: { ticker: string; weight: number }[];
  runsLeft?: number;
}
