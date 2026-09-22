import { LoginButton, usePyre } from "@pyre/app-sdk/react";
import { useMemo, useState } from "react";
import { BasketCardView, Button, ButtonLink, Card, CardSkeleton, Chip, EmptyState, PERKS, PageHeader, PerkLocked, Skeleton, buttonClass, useToast } from "../components";
import { api } from "../lib/api";
import { cardOf } from "../lib/autoBaskets";
import { useCoinsFor } from "../lib/coins";
import { errorMessage } from "../lib/format";
import { editHref } from "../lib/route";
import { useAsync } from "../lib/useAsync";

export function Mine() {
  const { user, loading } = usePyre();

  return (
    <section aria-label="My baskets" className="flex flex-col gap-8">
      <PageHeader actions={user ? <ButtonLink href="#/new">Build a basket</ButtonLink> : undefined} description="Everything you have published, your free-tier allowance, and what holding the coin unlocks." eyebrow="account" title="My baskets" />
      {loading ? (
        <div aria-busy="true" aria-label="Loading account" className="grid gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : user ? (
        <SignedIn />
      ) : (
        <SignedOut />
      )}
    </section>
  );
}

function SignedOut() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <EmptyState
        action={<LoginButton className={buttonClass("primary", "md")}>Sign in</LoginButton>}
        description="Sign in with Google to publish baskets, edit them later and see your allowance. The gallery and the builder work without an account."
        title="Sign in to save baskets"
      />
      <Perks />
    </div>
  );
}

function Perks() {
  const { holder } = usePyre();
  return (
    <Card actions={<Chip tone="violet">{holder.isHolder ? "unlocked" : "locked"}</Chip>} description="Extra depth for people holding the app's coin. No purchase, no paywall." title="Holder perks">
      <ul className="flex flex-col divide-y divide-border">
        {PERKS.map((perk) => (
          <li key={perk.title} className="py-3">
            <p className="text-sm text-ink">{perk.title}</p>
            <p className="text-sm text-ink-muted">{perk.body}</p>
          </li>
        ))}
      </ul>
      {!holder.isHolder ? (
        <div className="mt-4">
          <PerkLocked body="All three perks unlock together." title="Hold the coin" />
        </div>
      ) : null}
    </Card>
  );
}

function SignedIn() {
  const { toast } = useToast();
  const result = useAsync(() => api.mine(), []);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);

  const baskets = useMemo(() => (result.data?.baskets ?? []).filter((b) => !removed.includes(b.id)), [result.data, removed]);
  const slugs = useMemo(() => baskets.flatMap((b) => b.tokens.map((t) => t.slug)), [baskets]);
  const coins = useCoinsFor(slugs);

  const remove = async (id: string): Promise<void> => {
    setRemoving(id);
    try {
      const res = await api.remove(id);
      if (!res.ok) {
        toast(res.error ?? "Could not delete that basket.", "error");
        return;
      }
      setRemoved((list) => [...list, id]);
      toast("Basket deleted");
    } catch (cause) {
      toast(errorMessage(cause), "error");
    } finally {
      setRemoving(null);
    }
  };

  if (result.status === "loading" && !result.data) {
    return (
      <div aria-busy="true" aria-label="Loading your baskets" className="flex flex-col gap-6">
        <Skeleton className="h-16" />
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }
  if (result.status === "error" && !result.data) {
    return <EmptyState action={<Button onClick={result.retry}>Try again</Button>} description={result.error} role="alert" title="Your baskets did not load" />;
  }
  const data = result.data;
  if (!data || !data.ok) return <SignedOut />;

  const used = baskets.length;
  const allowance = data.unlimited ? "Unlimited baskets: holder tier." : `${used} of ${data.freeLimit} free baskets used.`;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink">{allowance}</p>
          {data.unlimited ? <Chip tone="violet">holder</Chip> : <Chip>{Math.max(0, data.freeLimit - used)} left</Chip>}
        </div>
      </Card>

      {baskets.length === 0 ? (
        <EmptyState action={<ButtonLink href="#/new">Build a basket</ButtonLink>} description="Pick coins from Pyre, set the split, publish." title="Nothing published yet" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" data-testid="mine-list">
          {baskets.map((basket) => (
            <BasketCardView
              key={basket.id}
              actions={
                <>
                  <ButtonLink href={editHref(basket.id)} size="sm" variant="secondary">
                    Edit
                  </ButtonLink>
                  <Button disabled={removing === basket.id} onClick={() => void remove(basket.id)} size="sm" variant="ghost">
                    {removing === basket.id ? "Deleting…" : "Delete"}
                  </Button>
                </>
              }
              bySlug={coins.bySlug}
              card={cardOf(basket)}
              pricing={coins.status === "loading"}
            />
          ))}
        </ul>
      )}

      <Perks />
    </div>
  );
}
