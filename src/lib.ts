import { InsufficientFundsError, NotAuthenticatedError } from "@pyre/app-sdk";
import type { TokenWeight } from "./types";

/**
 * Categorical series colours, stepped for this app's dark surface and validated
 * as a set (adjacent-pair CVD separation, chroma floor, contrast). Assigned in
 * fixed slot order and never cycled — a 9th coin folds into "Other".
 */
export const SERIES = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
] as const;

export const SERIES_MAX = SERIES.length;
export const OTHER_COLOR = "#6b6b78";

export function seriesColor(index: number): string {
  return index < SERIES_MAX ? (SERIES[index] as string) : OTHER_COLOR;
}

/** Turns any thrown value into a sentence a user can act on. */
export function errorMessage(cause: unknown): string {
  if (cause instanceof NotAuthenticatedError) return "Log in to do that.";
  if (cause instanceof InsufficientFundsError) {
    const price = cause.priceUsd === null ? "the price" : `$${cause.priceUsd}`;
    const address = cause.depositAddress ? ` Top up by sending USDG to ${cause.depositAddress}.` : "";
    return `Your Pyre wallet is short of ${price} in USDG.${address}`;
  }
  if (cause instanceof Error && cause.message !== "") return cause.message;
  return "Something went wrong. Try again.";
}

export function usd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

/**
 * Splits a budget across weights in whole cents. Remainder cents go to the
 * largest weights first, so the parts always add back up to the budget.
 */
export function splitBudget(budget: number, tokens: TokenWeight[]): { ticker: string; amount: number }[] {
  const cents = Math.max(0, Math.round(budget * 100));
  const total = tokens.reduce((acc, t) => acc + t.weight, 0) || 1;
  const rows = tokens.map((t, index) => {
    const exact = (cents * t.weight) / total;
    return { ticker: t.ticker, index, weight: t.weight, base: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = cents - rows.reduce((acc, r) => acc + r.base, 0);
  [...rows]
    .sort((a, b) => b.rest - a.rest || b.weight - a.weight)
    .forEach((row) => {
      if (left > 0) {
        row.base += 1;
        left -= 1;
      }
    });
  return rows.map((r) => ({ ticker: r.ticker, amount: r.base / 100 }));
}

/** Even split that still totals 100: the first `100 % n` coins get one extra point. */
export function evenWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const extra = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Rescales arbitrary weights to sum to exactly 100, keeping every coin above 0%. */
export function normalizeWeights(weights: number[]): number[] {
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((acc, w) => acc + w, 0);
  if (sum === 0) return evenWeights(weights.length);
  const rows = clean.map((w, index) => {
    const exact = (w * 100) / sum;
    return { index, weight: Math.floor(exact), rest: exact % 1 };
  });
  let left = 100 - rows.reduce((acc, r) => acc + r.weight, 0);
  [...rows]
    .sort((a, b) => b.rest - a.rest)
    .forEach((row) => {
      if (left > 0) {
        row.weight += 1;
        left -= 1;
      }
    });
  for (const row of rows) {
    if (row.weight === 0) {
      const biggest = rows.reduce((a, b) => (b.weight > a.weight ? b : a), rows[0] as (typeof rows)[number]);
      if (biggest.weight > 1) {
        biggest.weight -= 1;
        row.weight = 1;
      }
    }
  }
  return rows.map((r) => r.weight);
}

/** Gallery tag filter, round-tripped through the URL hash so it can be linked to and shared. */
export function tagHref(tag: string): string {
  return tag === "" ? "#/" : `#/?tag=${encodeURIComponent(tag)}`;
}

export function tagFromHash(hash: string): string {
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return "";
  const tag = new URLSearchParams(hash.slice(qIndex + 1)).get("tag") ?? "";
  return tag.trim().toLowerCase().slice(0, 40);
}

export function relativeDate(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} month${months === 1 ? "" : "s"} ago` : `${Math.floor(days / 365)}y ago`;
}
