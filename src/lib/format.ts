import { NotAuthenticatedError, PyreError } from "@pyre/app-sdk";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const trimZeros = (s: string): string => (s.includes(".") ? s.replace(/\.?0+$/, "") : s);

/** Whole-cent money: "$1,234.56". */
export function usdCents(cents: number): string {
  return USD.format(cents / 100);
}

/** Pyre-style compact money: "$1.2M", "$45.3k", "$980", "$0.42". Thousands compact from 10k. */
export function usdCompact(usd: number): string {
  if (!Number.isFinite(usd)) return "$—";
  const neg = usd < 0;
  const abs = Math.abs(usd);
  const tiers: [number, number, string][] = [
    [1e12, 1e12, "T"],
    [1e9, 1e9, "B"],
    [1e6, 1e6, "M"],
    [1e4, 1e3, "k"],
  ];
  for (const [from, size, suffix] of tiers) {
    if (abs >= from) return `${neg ? "-" : ""}$${trimZeros((abs / size).toFixed(2))}${suffix}`;
  }
  return `${neg ? "-" : ""}$${abs >= 100 ? abs.toFixed(0) : abs.toFixed(2)}`;
}

/** Tiny per-token prices keep three significant digits: "$0.0000225", "$0.0042", "$1.20". */
export function priceUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0";
  if (usd >= 1) return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  const decimals = Math.min(20, 2 - Math.floor(Math.log10(usd)));
  return `$${trimZeros(usd.toFixed(decimals))}`;
}

/** Signed percent: "+3.2%", "-0.4%", "0%". Null → "—". */
export function pct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const s = trimZeros(Math.abs(value).toFixed(digits));
  return value > 0 ? `+${s}%` : value < 0 ? `-${s}%` : `${s}%`;
}

/** Plain counts: "1,234", "12.4k", "1.2M". */
export function count(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${trimZeros((n / 1e9).toFixed(1))}B`;
  if (n >= 1e6) return `${trimZeros((n / 1e6).toFixed(1))}M`;
  if (n >= 1e4) return `${trimZeros((n / 1e3).toFixed(1))}k`;
  return n.toLocaleString("en-US");
}

/** Token quantity: "1.2B", "412.5M", "1,234", "0.42". */
export function qty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${trimZeros((n / 1e9).toFixed(2))}B`;
  if (n >= 1e6) return `${trimZeros((n / 1e6).toFixed(2))}M`;
  if (n >= 1e4) return `${trimZeros((n / 1e3).toFixed(2))}k`;
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return Number(n.toPrecision(3)).toString();
}

/** Turns any thrown value into a sentence a user can act on. */
export function errorMessage(cause: unknown): string {
  if (cause instanceof NotAuthenticatedError) return "Sign in to do that.";
  if (cause instanceof PyreError && cause.status === 403) return "That needs the holder tier.";
  if (cause instanceof Error && cause.message !== "") return cause.message;
  return "Something went wrong. Try again.";
}

export function relativeDate(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
