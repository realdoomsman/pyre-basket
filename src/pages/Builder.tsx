import { LoginButton, usePyre } from "@pyre/app-sdk/react";
import { useState } from "react";
import { Button, ButtonLink, Card, Chip, CoinAvatar, CoinPicker, Donut, EmptyState, FREE_LIMIT, Input, PageHeader, PerkGate, PerkLocked, Skeleton, TextArea, buttonClass, cx, useToast } from "../components";
import { api } from "../lib/api";
import { useUniverse, type Coin } from "../lib/coins";
import { draftFromBasket, emptyDraft, rowFromCoin, takeDraft, type Draft, type DraftRow } from "../lib/draft";
import { errorMessage } from "../lib/format";
import { detailHref, navigate } from "../lib/route";
import { useAsync } from "../lib/useAsync";
import { MAX_COINS, MIN_COINS, evenWeights, heatByRank, scaleTo100 } from "../lib/weights";

export function Builder({ editId }: { editId: string | null }) {
  if (editId === null) return <BuilderForm initial={takeDraft() ?? emptyDraft()} />;
  return <EditLoader id={editId} />;
}

function EditLoader({ id }: { id: string }) {
  const { user, loading } = usePyre();
  const result = useAsync(() => api.basket(id), [id]);

  if (loading || result.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading basket" className="flex flex-col gap-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (result.status === "error") {
    return <EmptyState action={<Button onClick={result.retry}>Try again</Button>} description={result.error} role="alert" title="Could not open that basket" />;
  }
  const basket = result.data.basket;
  if (!basket || !user || !basket.mine) {
    return (
      <EmptyState
        action={
          <ButtonLink href={basket ? detailHref(basket.id) : "#/"} variant="secondary">
            {basket ? "Open basket" : "Back to gallery"}
          </ButtonLink>
        }
        description={basket ? "You can remix it into a new basket of your own instead." : "It may have been deleted."}
        title={basket ? "Not yours to edit" : "No basket here"}
      />
    );
  }
  return <BuilderForm initial={draftFromBasket(basket, "edit")} />;
}

/* ---- Validation ------------------------------------------------------------------------- */

interface Check {
  ok: boolean;
  text: string;
}

function validate(draft: Draft): { checks: Check[]; sum: number; valid: boolean } {
  const sum = draft.rows.reduce((acc, r) => acc + r.weight, 0);
  const checks: Check[] = [
    { ok: draft.rows.length >= MIN_COINS, text: `At least ${MIN_COINS} legs (${draft.rows.length} so far)` },
    { ok: draft.rows.length > 0 && draft.rows.every((r) => r.weight >= 1), text: "Every leg at 1% or more" },
    { ok: draft.rows.length > 0 && sum === 100, text: "Weights total exactly 100%" },
    { ok: draft.title.trim().length >= 3, text: "A title (3+ characters)" },
    { ok: draft.description.trim().length >= 10, text: "A short description (10+ characters)" },
  ];
  return { checks, sum, valid: checks.every((c) => c.ok) };
}

/* ---- Form ------------------------------------------------------------------------------- */

function BuilderForm({ initial }: { initial: Draft }) {
  const { user, loading } = usePyre();
  const { toast } = useToast();
  const universe = useUniverse();
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ reason: string; text: string } | null>(null);
  const [attempted, setAttempted] = useState(false);

  const editing = draft.editId !== null;
  const v = validate(draft);
  const colours = heatByRank(draft.rows.map((r) => r.weight));

  const patch = (changes: Partial<Draft>): void => setDraft((d) => ({ ...d, ...changes }));
  const setWeights = (weights: number[]): void => setDraft((d) => ({ ...d, rows: d.rows.map((r, i) => ({ ...r, weight: weights[i] ?? r.weight })) }));
  const addCoin = (coin: Coin): void => {
    setDraft((d) => {
      if (d.rows.length >= MAX_COINS || d.rows.some((r) => r.slug === coin.slug)) return d;
      // A new leg joins at an even share and the others shrink to make room, so the total stays 100.
      const rows = [...d.rows, rowFromCoin(coin, 0)];
      const weights = evenWeights(rows.length);
      return { ...d, rows: rows.map((r, i) => ({ ...r, weight: weights[i] ?? 0 })) };
    });
  };
  const removeRow = (key: number): void => patch({ rows: draft.rows.filter((r) => r.key !== key) });

  const save = async (): Promise<void> => {
    setAttempted(true);
    if (!v.valid) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.publish({
        ...(draft.editId ? { id: draft.editId } : {}),
        title: draft.title.trim(),
        description: draft.description.trim(),
        rationale: draft.rationale.trim(),
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        tokens: draft.rows.map(({ slug, ticker, name, tokenAddress, weight }) => ({ slug, ticker, name, tokenAddress, weight })),
        creatorName: user?.displayName ?? "",
      });
      if (!res.ok || !res.basket) {
        setSaveError({ reason: res.reason ?? "invalid", text: res.error ?? "Could not save the basket." });
        return;
      }
      toast(editing ? "Changes saved" : "Basket published");
      navigate(detailHref(res.basket.id));
    } catch (cause) {
      setSaveError({ reason: "error", text: errorMessage(cause) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rise flex flex-col gap-8">
      <PageHeader
        description={`Pick ${MIN_COINS} to ${MAX_COINS} coins launched on Pyre, set the split, and publish. Weights are percentages that must total 100.`}
        eyebrow={editing ? "editing" : "builder"}
        title={editing ? "Edit basket" : "Build a basket"}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <Card actions={<Chip>{universe.coins.length} on Pyre</Chip>} description="Every coin launched on Pyre, trending first. Add one to make it a leg." title="Coins">
            <CoinPicker disabled={draft.rows.length >= MAX_COINS} onPick={addCoin} selected={draft.rows.map((r) => r.slug)} universe={universe} />
          </Card>

          <Card
            actions={
              <span className={cx("font-mono text-sm tabular-nums", v.sum === 100 ? "text-ink" : "text-danger")} data-testid="weight-total">
                {v.sum}% of 100%
              </span>
            }
            description="Drag a slider or type a percentage. Equal split and Scale to 100 keep the total honest."
            title="Legs"
          >
            {draft.rows.length === 0 ? (
              <EmptyState description="Add coins from the list above." title="No legs yet" />
            ) : (
              <ol className="flex flex-col gap-3">
                {draft.rows.map((row, i) => (
                  <LegRow key={row.key} colour={colours[i] ?? "#3B2F7A"} coin={universe.bySlug[row.slug]} index={i} onChange={(weight) => patch({ rows: draft.rows.map((r) => (r.key === row.key ? { ...r, weight } : r)) })} onRemove={() => removeRow(row.key)} row={row} />
                ))}
              </ol>
            )}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button disabled={draft.rows.length === 0} onClick={() => setWeights(evenWeights(draft.rows.length))} variant="secondary">
                Equal split
              </Button>
              <Button disabled={draft.rows.length === 0 || v.sum === 100 || v.sum === 0} onClick={() => setWeights(scaleTo100(draft.rows.map((r) => r.weight)))} variant="secondary">
                Scale to 100
              </Button>
            </div>
          </Card>

          <Card title="About">
            <div className="flex flex-col gap-4">
              <Input error={attempted && draft.title.trim().length < 3 ? "3 characters or more." : undefined} label="Title" maxLength={60} onChange={(e) => patch({ title: e.target.value })} placeholder="Trending, equal weight" value={draft.title} />
              <TextArea error={attempted && draft.description.trim().length < 10 ? "10 characters or more." : undefined} hint="What is the theme? Two or three sentences." label="Description" maxLength={600} onChange={(e) => patch({ description: e.target.value })} value={draft.description} />
              <Input hint="Optional. One sentence on the split." label="Why these weights" maxLength={400} onChange={(e) => patch({ rationale: e.target.value })} value={draft.rationale} />
              <Input hint="Comma separated, up to 6. Lowercase letters, digits and dashes." label="Tags" onChange={(e) => patch({ tags: e.target.value })} placeholder="trending, equal-weight" value={draft.tags} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <Card title="Preview">
            <div className="flex items-start gap-5">
              <Donut size={132} slices={draft.rows} thickness={20}>
                <div>
                  <div className="font-mono text-xl tabular-nums text-ink">{draft.rows.length}</div>
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">legs</div>
                </div>
              </Donut>
              <ul className="flex min-w-0 flex-1 flex-col">
                {draft.rows.length === 0 ? (
                  <li className="text-sm text-ink-faint">Add coins to see the split.</li>
                ) : (
                  draft.rows.map((r, i) => (
                    <li key={r.key} className="flex items-center gap-2 py-1 font-mono text-sm">
                      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: colours[i] }} />
                      <span className="text-ink">{r.ticker}</span>
                      <span className="ml-auto tabular-nums text-ink-muted">{r.weight}%</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <ul aria-label="Before you publish" className="mt-5 flex flex-col gap-1.5 border-t border-border pt-4">
              {v.checks.map((c) => (
                <li key={c.text} className={cx("flex items-center gap-2 text-sm", c.ok ? "text-ink-muted" : attempted ? "text-danger" : "text-ink-faint")}>
                  <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", c.ok ? "bg-violet" : "border border-border-strong")} />
                  <span className="sr-only">{c.ok ? "Done:" : "To do:"}</span>
                  {c.text}
                </li>
              ))}
            </ul>

            <div className="mt-5">
              {loading ? (
                <Skeleton className="h-10" />
              ) : user ? (
                <div className="flex flex-col gap-3">
                  <Button className="w-full" disabled={saving || (attempted && !v.valid)} onClick={() => void save()}>
                    {saving ? "Saving…" : editing ? "Save changes" : "Publish basket"}
                  </Button>
                  {saveError ? (
                    <div className="flex flex-col gap-3" role="alert">
                      <p className="text-sm text-danger">{saveError.text}</p>
                      {saveError.reason === "limit" ? <PerkLocked body={`The free tier keeps ${FREE_LIMIT} baskets. Delete one, or hold the coin to lift the cap.`} title="Unlimited baskets" /> : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4" data-testid="publish-login">
                  <p className="text-sm text-ink-muted">Sign in to publish. Everything above works without an account.</p>
                  <LoginButton className={buttonClass("primary", "md")}>Sign in to publish</LoginButton>
                </div>
              )}
            </div>
          </Card>

          <PerkGate body="Give it your legs and a one-line goal; it writes the title, the description and a split that totals 100." title="AI drafting">
            <AssistantForm
              onDraft={(next) => setDraft((d) => ({ ...d, ...next }))}
              rows={draft.rows}
            />
          </PerkGate>
        </div>
      </div>
    </div>
  );
}

/* ---- Leg row ---------------------------------------------------------------------------- */

interface LegRowProps {
  index: number;
  row: DraftRow;
  coin: Coin | undefined;
  colour: string;
  onChange: (weight: number) => void;
  onRemove: () => void;
}

function LegRow({ index, row, coin, colour, onChange, onRemove }: LegRowProps) {
  const n = index + 1;
  const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-bg p-3">
      <div className="flex items-center gap-3">
        <CoinAvatar imageUrl={coin?.imageUrl ?? ""} ticker={row.ticker} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm text-ink">{row.ticker}</span>
            <span className="truncate text-xs text-ink-faint">{row.name}</span>
          </div>
        </div>
        <Input
          aria-label={`Weight % ${n}`}
          className="w-20"
          inputMode="numeric"
          max={100}
          min={0}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          step={1}
          type="number"
          value={row.weight === 0 ? "" : String(row.weight)}
        />
        <Button aria-label={`Remove ${row.ticker}`} onClick={onRemove} size="sm" variant="ghost">
          Remove
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: colour }} />
        <input
          aria-label={`Weight slider ${n}`}
          aria-valuetext={`${row.weight}%`}
          max={100}
          min={0}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          step={1}
          style={{ ["--track" as string]: `linear-gradient(90deg, ${colour} ${row.weight}%, var(--color-border-strong) ${row.weight}%)` }}
          type="range"
          value={row.weight}
        />
      </div>
    </li>
  );
}

/* ---- AI assistant (holder perk) ---------------------------------------------------------- */

function AssistantForm({ rows, onDraft }: { rows: DraftRow[]; onDraft: (next: Partial<Draft>) => void }) {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const run = async (): Promise<void> => {
    setBusy(true);
    setNote(null);
    try {
      const res = await api.assist({ tokens: rows.map((r) => ({ ticker: r.ticker })), goal });
      if (!res.ok) {
        setNote({ text: res.error ?? "The assistant could not draft that.", tone: "error" });
        return;
      }
      const byTicker: Record<string, number> = {};
      for (const w of res.weights ?? []) byTicker[w.ticker] = w.weight;
      onDraft({
        title: res.title ?? "",
        description: res.description ?? "",
        rationale: res.rationale ?? "",
        rows: rows.map((r) => ({ ...r, weight: byTicker[r.ticker] ?? r.weight })),
      });
      setNote({ text: `Draft applied. ${res.runsLeft ?? 0} runs left today.`, tone: "info" });
    } catch (cause) {
      setNote({ text: errorMessage(cause), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card actions={<Chip tone="violet">holder perk</Chip>} description="Your legs plus a one-line goal in; a title, a description and a weighted split out." title="AI drafting">
      <div className="flex flex-col gap-3">
        <Input hint="One line, e.g. lean into the two biggest and keep the rest small." label="Goal" maxLength={200} onChange={(e) => setGoal(e.target.value)} value={goal} />
        <Button disabled={busy || rows.length < MIN_COINS} onClick={() => void run()}>
          {busy ? "Drafting…" : "Draft title, text and weights"}
        </Button>
        {rows.length < MIN_COINS ? <p className="text-sm text-ink-faint">Add at least {MIN_COINS} legs first.</p> : null}
        {note ? (
          <p className={cx("text-sm", note.tone === "error" ? "text-danger" : "text-ink-muted")} role="status">
            {note.text}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

