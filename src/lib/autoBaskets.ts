import type { Coin } from "./coins";
import { evenWeights, scaleTo100 } from "./weights";
import type { Basket, BasketCard } from "../types";

/**
 * Baskets the app derives from the coin universe on every visit: real coins, real weights,
 * nothing stored. They keep the gallery useful before anyone has published and double as
 * worked examples of the format. Every surface labels them "auto".
 */
export const AUTO_IDS = ["auto-trending", "auto-capweight", "auto-new"] as const;

export function isAutoId(id: string): boolean {
  return (AUTO_IDS as readonly string[]).includes(id);
}

const STAMP = "1970-01-01T00:00:00.000Z";

function build(id: string, title: string, description: string, rationale: string, tags: string[], coins: Coin[], weights: number[]): Basket {
  return {
    id,
    title,
    description,
    rationale,
    tags,
    tokens: coins.map((c, i) => ({ slug: c.slug, ticker: c.ticker, name: c.name, tokenAddress: c.tokenAddress, weight: weights[i] ?? 0 })),
    creatorId: null,
    creatorName: "Basket",
    featured: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    auto: true,
    mine: false,
  };
}

/** `trending` and `fresh` are the host's own orderings; only coins with a price qualify. */
export function autoBaskets(trending: Coin[], fresh: Coin[]): Basket[] {
  const priced = (list: Coin[]): Coin[] => list.filter((c) => c.priceUsd > 0);
  const top5 = priced(trending).slice(0, 5);
  const top8 = priced(trending).slice(0, 8);
  const new5 = priced(fresh).slice(0, 5);
  const out: Basket[] = [];
  if (top5.length >= 2) {
    out.push(
      build(
        "auto-trending",
        "Trending, equal weight",
        `The ${top5.length} coins Pyre ranks as trending right now, each at the same weight. Rebuilt from live data on every visit.`,
        "Equal weight so no single coin decides the outcome.",
        ["auto", "trending", "equal-weight"],
        top5,
        evenWeights(top5.length),
      ),
    );
  }
  if (top8.length >= 2) {
    out.push(
      build(
        "auto-capweight",
        "Trending, cap weighted",
        `The top ${top8.length} trending coins, weighted by market cap. Bigger coins take bigger slices, like an index would.`,
        "Weights follow market cap, so the basket leans toward whatever has already found the most buyers.",
        ["auto", "trending", "cap-weighted"],
        top8,
        scaleTo100(top8.map((c) => c.mcapUsd)),
      ),
    );
  }
  if (new5.length >= 2) {
    out.push(
      build(
        "auto-new",
        "Fresh launches",
        `The ${new5.length} newest coins on Pyre at equal weight. Young coins have no 24h history yet; the headline says how much it covers.`,
        "Equal weight, because there is nothing to weight by yet.",
        ["auto", "new", "equal-weight"],
        new5,
        evenWeights(new5.length),
      ),
    );
  }
  return out;
}

export function cardOf(basket: Basket): BasketCard {
  return {
    id: basket.id,
    title: basket.title,
    blurb: basket.description,
    tags: basket.tags,
    tokens: basket.tokens.map((t) => ({ slug: t.slug, ticker: t.ticker, weight: t.weight })),
    creatorName: basket.creatorName,
    featured: basket.featured,
    auto: basket.auto,
    createdAt: basket.createdAt,
  };
}
