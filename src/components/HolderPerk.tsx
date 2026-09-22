import { pyreEnv } from "@pyre/app-sdk";
import { HolderGate, usePyre } from "@pyre/app-sdk/react";
import type { ReactNode } from "react";
import { Chip } from "./Chip";

export const FREE_LIMIT = 3;

export const PERKS = [
  { title: "AI drafting", body: "Your legs plus a one-line goal in; a titled, described and weighted basket out." },
  { title: "Unlimited baskets", body: `The free tier keeps ${FREE_LIMIT}. Holders keep as many as they like.` },
  { title: "Featured placement", body: "Your baskets sort to the top of the gallery under Featured." },
] as const;

/** Threshold sentence, e.g. "Hold 5,000,000 $BASKET". Falls back to the coin name pre-launch. */
export function useHolderRequirement(): string {
  const env = pyreEnv();
  const { holder } = usePyre();
  const min = Number(holder.minHold || env.holderMin || 0);
  const coin = env.ticker ? `$${env.ticker}` : "the app coin";
  return min > 0 ? `Hold ${min.toLocaleString("en-US")} ${coin}` : `Hold ${coin}`;
}

/** The locked side of a holder perk: what it is, what unlocks it, where to get the coin. */
export function PerkLocked({ title, body }: { title: string; body: ReactNode }) {
  const env = pyreEnv();
  const requirement = useHolderRequirement();
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-violet">holder perk</span>
        <Chip tone="violet">locked</Chip>
      </div>
      <div>
        <h3 className="text-lg text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{body}</p>
      </div>
      <p className="text-sm text-ink-faint">
        {requirement} to unlock.{" "}
        {env.tokenAddress !== "" ? (
          <a className="text-violet hover:underline" href={`https://www.ponsfamily.com/launchpad/${env.tokenAddress}`} rel="noopener noreferrer" target="_blank">
            Get it on PONS
          </a>
        ) : (
          "The coin has not launched yet."
        )}
      </p>
    </div>
  );
}

/** `HolderGate` with the app's standard locked card as the fallback. */
export function PerkGate({ title, body, children }: { title: string; body: ReactNode; children: ReactNode }) {
  return <HolderGate fallback={<PerkLocked body={body} title={title} />}>{children}</HolderGate>;
}
