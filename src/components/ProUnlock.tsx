import { useState } from "react";
import { pyreEnv, ship } from "@pyre/app-sdk";
import { LoginButton, usePyre } from "@pyre/app-sdk/react";
import { errorMessage } from "../lib";
import { btnPrimary, panel } from "../ui";

export const PRO_ID = "basket-pro";

function price(): string {
  const product = (pyreEnv().products ?? []).find((p) => p.id === PRO_ID);
  return product ? `$${product.priceUsd}` : "$8";
}

/**
 * The one-time Basket Pro unlock. `charge()` is the platform's checkout — it moves USDG
 * from the user's custodial wallet — and `unlock` then records the entitlement server-side
 * so the basket limit and the assistant honour it on later calls.
 */
export default function ProUnlock({ onUnlocked, compact }: { onUnlocked?: () => void; compact?: boolean }) {
  const { user, purchases, charge, refresh, holder } = usePyre();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const owned = purchases.includes(PRO_ID);

  const buy = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const paid = await charge(PRO_ID);
      await ship.fn("unlock", { txHash: paid.txHash });
      await refresh();
      onUnlocked?.();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (owned) {
    return (
      <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink" data-testid="pro-active">
        Basket Pro is active — unlimited baskets and the AI assistant are unlocked.
      </p>
    );
  }

  if (holder.isHolder) {
    return (
      <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink">
        You hold enough ${pyreEnv().ticker ?? "coin"} — Pro features are already yours, no purchase needed.
      </p>
    );
  }

  return (
    <div className={compact ? "rounded-xl border border-edge/70 bg-panel-2/60 p-4" : panel}>
      <h3 className="text-base font-semibold">Basket Pro — {price()} once</h3>
      <ul className="mt-2 space-y-1 text-sm text-ink-dim">
        <li>· Unlimited saved baskets (free accounts keep 2)</li>
        <li>· AI assistant: title, description and weight split from one line of intent</li>
        <li>· Paid in USDG from your Pyre wallet, no card and nothing to sign</li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {user ? (
          <button className={btnPrimary} disabled={busy} onClick={() => void buy()} type="button">
            {busy ? "Charging your wallet…" : `Unlock Pro for ${price()}`}
          </button>
        ) : (
          <>
            <LoginButton className={btnPrimary}>Log in to unlock Pro</LoginButton>
            <span className="text-xs text-ink-faint">Browsing and the builder stay free.</span>
          </>
        )}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
