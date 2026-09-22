import { useId, useMemo, useState } from "react";
import { splitBudget, usd } from "../lib";
import type { TokenWeight } from "../types";

const PRESETS = [50, 100, 500];

/**
 * "How to buy": turns a budget into a per-coin dollar list the user executes by
 * hand. There is no price feed here — these are dollar amounts, not coin amounts.
 */
export default function SplitCalculator({ tokens }: { tokens: TokenWeight[] }) {
  const inputId = useId();
  const [raw, setRaw] = useState("100");
  const budget = Number.parseFloat(raw);
  const valid = Number.isFinite(budget) && budget > 0;
  const rows = useMemo(() => (valid ? splitBudget(budget, tokens) : []), [budget, tokens, valid]);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (): Promise<void> => {
    const text = rows.map((r) => `${usd(r.amount)} ${r.ticker}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Shopping list copied.");
    } catch {
      setCopied("Copying is blocked in this browser — the list is on screen.");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-dim" htmlFor={inputId}>
            Your budget (USD)
          </label>
          <div className="mt-1 flex items-center gap-1 rounded-lg border border-edge bg-canvas px-3 py-2 focus-within:border-accent">
            <span aria-hidden="true" className="text-ink-faint">
              $
            </span>
            <input
              className="w-24 bg-transparent font-mono tabular-nums outline-none"
              id={inputId}
              inputMode="decimal"
              min="0"
              onChange={(e) => {
                setRaw(e.target.value);
                setCopied(null);
              }}
              step="any"
              type="number"
              value={raw}
            />
          </div>
        </div>
        <div className="flex gap-2">
          {PRESETS.map((preset) => (
            <button
              className="rounded-lg border border-edge px-3 py-2 text-sm text-ink-dim hover:border-accent hover:text-ink"
              key={preset}
              onClick={() => {
                setRaw(String(preset));
                setCopied(null);
              }}
              type="button"
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {valid ? (
        <>
          <ul className="mt-4 divide-y divide-edge/60 rounded-xl border border-edge/60" data-testid="split-rows">
            {rows.map((row) => (
              <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm" key={row.ticker}>
                <span className="font-semibold tracking-wide">{row.ticker}</span>
                <span className="font-mono tabular-nums text-ink-dim" data-testid={`split-${row.ticker}`}>
                  {usd(row.amount)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg border border-edge px-3 py-1.5 text-sm text-ink-dim hover:border-accent hover:text-ink"
              onClick={() => void copy()}
              type="button"
            >
              Copy shopping list
            </button>
            {copied ? (
              <span className="text-xs text-ink-faint" role="status">
                {copied}
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-warn" role="status">
          Enter a budget above $0 to see the split.
        </p>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        Buy each amount yourself in your own wallet or exchange. Basket never holds funds, places orders, or reads
        live prices — these are dollar amounts to allocate, not coin quantities.
      </p>
    </div>
  );
}
