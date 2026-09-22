import { useCallback, useEffect, useState } from "react";
import { pyreEnv, ship } from "@pyre/app-sdk";
import { HolderGate, LoginButton, usePyre } from "@pyre/app-sdk/react";
import { errorMessage, relativeDate } from "../lib";
import { btnDanger, btnGhost, btnPrimary, panel } from "../ui";
import { draftFromBasket, setDraft } from "../draft";
import ProUnlock, { PRO_ID } from "./ProUnlock";
import type { Basket, MineResult } from "../types";

export default function Mine() {
  const { user, purchases, loading: sessionLoading } = usePyre();
  const [data, setData] = useState<MineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      let result = await ship.fn<MineResult>("mine", {});
      // Paid on another device (or before the entitlement was stored): record it now.
      if (result.ok && result.paid === false && purchases.includes(PRO_ID)) {
        await ship.fn("unlock", {});
        result = await ship.fn<MineResult>("mine", {});
      }
      setData(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [purchases]);

  useEffect(() => {
    if (user === null) {
      setData(null);
      return;
    }
    void load();
  }, [user, load]);

  const destroy = async (id: string): Promise<void> => {
    setBusyId(id);
    setError(null);
    try {
      const result = await ship.fn<{ ok: boolean; error?: string }>("remove", { id });
      if (!result.ok) setError(result.error ?? "That basket could not be deleted.");
      setPendingDelete(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  const edit = (basket: Basket): void => {
    setDraft(draftFromBasket(basket, { edit: true }));
    window.location.hash = `#/edit/${basket.id}`;
  };

  const ticker = pyreEnv().ticker ?? "coin";

  return (
    <section aria-labelledby="mine-heading" className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold" id="mine-heading">
          My baskets
        </h2>
        <p className="mt-1 text-sm text-ink-faint">
          Everything you have published, plus your plan. Free accounts keep 2 baskets.
        </p>
      </div>

      {user === null ? (
        <div className={panel}>
          {sessionLoading ? (
            <p className="text-sm text-ink-dim">Checking your session…</p>
          ) : (
            <>
              <h3 className="text-base font-semibold">Log in to save baskets</h3>
              <p className="mt-1 text-sm text-ink-faint">
                Browsing, the builder and the dollar-split calculator need no account. Publishing does, so a basket has
                an owner.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LoginButton className={btnPrimary}>Log in</LoginButton>
                <a className={btnGhost} href="#/new">
                  Keep building
                </a>
              </div>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <div className={`${panel} border-danger/50`} role="alert">
          <p className="text-sm">{error}</p>
          <button className={`${btnGhost} mt-3`} onClick={() => void load()} type="button">
            Try again
          </button>
        </div>
      ) : null}

      {user !== null ? (
        <>
          <div className="flex flex-col gap-4">
            {data !== null && !data.unlimited ? (
              <p className="text-sm text-ink-dim" data-testid="quota">
                {data.remaining ?? 0} of {data.freeLimit} free basket slots left.
              </p>
            ) : null}
            <ProUnlock onUnlocked={() => void load()} />
            <HolderGate
              fallback={
                <div className="rounded-xl border border-edge/70 bg-panel-2/60 p-4 text-sm text-ink-dim">
                  <p className="font-semibold text-ink">Holder perks</p>
                  <p className="mt-1">
                    Hold {Number(pyreEnv().holderMin ?? 0).toLocaleString("en-US")} ${ticker} and you get unlimited
                    baskets, the AI assistant and a featured slot in the gallery — no purchase needed.
                  </p>
                </div>
              }
            >
              <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
                <p className="font-semibold">Holder perks active</p>
                <p className="mt-1 text-ink-dim">
                  Unlimited baskets, the AI assistant, and every basket you publish is flagged Featured in the gallery.
                </p>
              </div>
            </HolderGate>
          </div>

          {loading && data === null ? (
            <ul aria-hidden="true" className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <li className="h-20 animate-pulse rounded-xl border border-edge/50 bg-panel/40" key={i} />
              ))}
            </ul>
          ) : null}

          {data !== null && data.ok && data.baskets.length === 0 ? (
            <div className={panel}>
              <p className="text-sm text-ink-dim">You have not published a basket yet.</p>
              <a className={`${btnPrimary} mt-3`} href="#/new">
                Build your first basket
              </a>
            </div>
          ) : null}

          {data !== null && data.baskets.length > 0 ? (
            <ul className="flex flex-col gap-3" data-testid="my-baskets">
              {data.baskets.map((basket) => (
                <li className="rounded-xl border border-edge/70 bg-panel/70 p-4" key={basket.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a className="font-semibold hover:underline" href={`#/b/${basket.id}`}>
                        {basket.title}
                      </a>
                      <p className="mt-1 text-xs text-ink-faint">
                        {basket.tokens.length} coins · {relativeDate(basket.createdAt)}
                        {basket.featured ? " · featured" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className={btnGhost} onClick={() => edit(basket)} type="button">
                        Edit
                      </button>
                      {pendingDelete === basket.id ? (
                        <>
                          <button
                            className={btnDanger}
                            disabled={busyId === basket.id}
                            onClick={() => void destroy(basket.id)}
                            type="button"
                          >
                            {busyId === basket.id ? "Deleting…" : "Confirm delete"}
                          </button>
                          <button className={btnGhost} onClick={() => setPendingDelete(null)} type="button">
                            Keep
                          </button>
                        </>
                      ) : (
                        <button className={btnDanger} onClick={() => setPendingDelete(basket.id)} type="button">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
