import { useState } from "react";
import type { Coin, Universe } from "../lib/coins";
import { usdCompact } from "../lib/format";
import { Button } from "./Button";
import { CoinAvatar } from "./CoinAvatar";
import { Delta } from "./Delta";
import { EmptyState } from "./EmptyState";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";

export interface CoinPickerProps {
  universe: Universe;
  /** Slugs already in the basket; they show as added. */
  selected: string[];
  disabled: boolean;
  onPick: (coin: Coin) => void;
}

const SHOW = 12;

/** Searchable list of every coin on Pyre: ticker, name, mcap, 24h. Picking one adds a leg. */
export function CoinPicker({ universe, selected, disabled, onPick }: CoinPickerProps) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = universe.coins.filter((c) => needle === "" || c.ticker.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle) || c.slug.includes(needle));
  const shown = matches.slice(0, SHOW);

  return (
    <div className="flex flex-col gap-3">
      <Input
        aria-label="Search coins by ticker or name"
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search coins by ticker or name"
        type="search"
        value={q}
      />
      {universe.status === "error" ? (
        <EmptyState
          action={
            <Button onClick={universe.retry} variant="secondary">
              Try again
            </Button>
          }
          description={universe.error}
          title="Coins did not load"
        />
      ) : universe.status === "loading" ? (
        <div aria-busy="true" aria-label="Loading coins" className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState description={needle === "" ? "Pyre has not listed any coins yet." : "No coin on Pyre matches that."} title="Nothing to add" />
      ) : (
        <ul aria-label="Coins on Pyre" className="flex flex-col divide-y divide-border rounded-card border border-border">
          {shown.map((coin) => {
            const added = selected.includes(coin.slug);
            return (
              <li key={coin.slug} className="flex items-center gap-3 px-3 py-2">
                <CoinAvatar imageUrl={coin.imageUrl} ticker={coin.ticker} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm text-ink">{coin.ticker}</span>
                    <span className="truncate text-xs text-ink-faint">{coin.name}</span>
                  </div>
                  <div className="flex gap-3 font-mono text-xs tabular-nums">
                    <span className="text-ink-muted">{coin.mcapUsd > 0 ? usdCompact(coin.mcapUsd) : "unpriced"}</span>
                    <Delta sinceLaunch={coin.young} value={coin.change24hPct} />
                  </div>
                </div>
                <Button
                  aria-label={added ? `${coin.ticker} added` : `Add ${coin.ticker}`}
                  disabled={added || disabled || coin.priceUsd <= 0}
                  onClick={() => onPick(coin)}
                  size="sm"
                  title={!added && coin.priceUsd <= 0 ? "Not priced on Pyre yet, so it cannot be sized into a basket." : undefined}
                  variant="secondary"
                >
                  {added ? "Added" : "Add"}
                </Button>
              </li>
            );
          })}
          {matches.length > SHOW ? <li className="px-3 py-2 text-xs text-ink-faint">{matches.length - SHOW} more; keep typing to narrow it down.</li> : null}
        </ul>
      )}
    </div>
  );
}
