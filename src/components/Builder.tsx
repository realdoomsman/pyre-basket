import { useEffect, useMemo, useState } from "react";
import { ship } from "@pyre/app-sdk";
import { LoginButton, usePyre } from "@pyre/app-sdk/react";
import { errorMessage, evenWeights, normalizeWeights } from "../lib";
import { btnGhost, btnPrimary, input, label, panel } from "../ui";
import { takeDraft, type Draft } from "../draft";
import ProUnlock, { PRO_ID } from "./ProUnlock";
import WeightBreakdown from "./WeightBreakdown";
import type { AssistResult, BasketResult, PublishResult, TokenWeight } from "../types";

const MAX_COINS = 12;

interface Row {
  ticker: string;
  name: string;
  weight: string;
}

const emptyRows = (): Row[] => [
  { ticker: "", name: "", weight: "" },
  { ticker: "", name: "", weight: "" },
];

function cleanTicker(value: string): string {
  return value.trim().toUpperCase().replace(/^\$/, "").replace(/[^A-Z0-9._-]/g, "");
}

export default function Builder({ editId }: { editId?: string }) {
  const { user, purchases, holder } = usePyre();
  const pro = purchases.includes(PRO_ID) || holder.isHolder;

  const [rows, setRows] = useState<Row[]>(emptyRows);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [tags, setTags] = useState("");
  const [loadedId, setLoadedId] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [goal, setGoal] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AssistResult | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hitLimit, setHitLimit] = useState(false);

  const applyDraft = (draft: Draft): void => {
    setTitle(draft.title);
    setDescription(draft.description);
    setRationale(draft.rationale);
    setTags(draft.tags);
    setRows(draft.tokens.length > 0 ? draft.tokens : emptyRows());
    setLoadedId(draft.editId);
  };

  // A draft handed over by "remix"/"edit"; otherwise an /edit/<id> deep link loads the record.
  useEffect(() => {
    const draft = takeDraft();
    if (draft !== null) {
      applyDraft(draft);
      return;
    }
    if (editId === undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await ship.fn<BasketResult>("basket", { id: editId });
        if (cancelled) return;
        if (result.basket === null) setLoadError(result.error ?? "That basket could not be loaded.");
        else {
          const b = result.basket;
          applyDraft({
            title: b.title,
            description: b.description,
            rationale: b.rationale ?? "",
            tags: b.tags.join(", "),
            tokens: b.tokens.map((t) => ({ ticker: t.ticker, name: t.name ?? "", weight: String(t.weight) })),
            editId: b.id,
          });
        }
      } catch (cause) {
        if (!cancelled) setLoadError(errorMessage(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const tokens: TokenWeight[] = useMemo(
    () =>
      rows
        .map((r) => ({ ticker: cleanTicker(r.ticker), name: r.name.trim(), weight: Math.round(Number(r.weight)) }))
        .filter((t) => t.ticker !== "" && Number.isFinite(t.weight) && t.weight > 0),
    [rows],
  );
  const total = tokens.reduce((acc, t) => acc + t.weight, 0);
  const filled = rows.filter((r) => cleanTicker(r.ticker) !== "");
  const duplicate = filled.length !== new Set(filled.map((r) => cleanTicker(r.ticker))).size;

  const setRow = (index: number, patch: Partial<Row>): void => {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setSaveError(null);
  };

  const spread = (weights: number[]): void => {
    let cursor = 0;
    setRows((current) =>
      current.map((row) => {
        if (cleanTicker(row.ticker) === "") return { ...row, weight: "" };
        const next = weights[cursor] ?? 0;
        cursor += 1;
        return { ...row, weight: String(next) };
      }),
    );
  };

  const evenSplit = (): void => spread(evenWeights(filled.length));

  const scaleTo100 = (): void =>
    spread(
      normalizeWeights(
        rows.filter((r) => cleanTicker(r.ticker) !== "").map((r) => Math.max(0, Number(r.weight) || 0)),
      ),
    );

  const runAssist = async (): Promise<void> => {
    setAssisting(true);
    setAssistError(null);
    setSuggestion(null);
    try {
      const result = await ship.fn<AssistResult>("assist", {
        tokens: tokens.length >= 2 ? tokens : filled.map((r) => ({ ticker: cleanTicker(r.ticker), name: r.name })),
        goal,
      });
      if (result.ok) setSuggestion(result);
      else setAssistError(result.error ?? "The assistant could not help with that.");
    } catch (cause) {
      setAssistError(errorMessage(cause));
    } finally {
      setAssisting(false);
    }
  };

  const applySuggestion = (): void => {
    if (suggestion === null) return;
    if (suggestion.title) setTitle(suggestion.title.slice(0, 60));
    if (suggestion.description) setDescription(suggestion.description);
    if (suggestion.rationale) setRationale(suggestion.rationale);
    const weights = suggestion.weights ?? [];
    setRows((current) =>
      current.map((row) => {
        const match = weights.find((w) => w.ticker === cleanTicker(row.ticker));
        return match ? { ...row, weight: String(match.weight) } : row;
      }),
    );
    setSuggestion(null);
  };

  const validation = (): string | null => {
    if (title.trim().length < 3) return "Give the basket a title (3+ characters).";
    if (description.trim().length < 10) return "Add a short description (10+ characters).";
    if (filled.length < 2) return "A basket needs at least 2 coins.";
    if (duplicate) return "Each coin needs its own row — one ticker is listed twice.";
    if (tokens.length !== filled.length) return "Every coin needs a weight above 0%.";
    if (total !== 100) return `Weights add up to ${total}% — they must total exactly 100%.`;
    return null;
  };

  const publish = async (): Promise<void> => {
    const problem = validation();
    if (problem !== null) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setHitLimit(false);
    try {
      const result = await ship.fn<PublishResult>("publish", {
        id: loadedId,
        title,
        description,
        rationale,
        tags: tags.split(/[,#]+/).map((t) => t.trim()),
        tokens,
        creatorName: user?.displayName ?? "",
      });
      if (result.ok && result.basket) {
        window.location.hash = `#/b/${result.basket.id}`;
        return;
      }
      if (result.reason === "limit") setHitLimit(true);
      setSaveError(result.error ?? "The basket could not be published.");
    } catch (cause) {
      setSaveError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="builder-heading" className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold" id="builder-heading">
          {loadedId === undefined ? "Build a basket" : "Edit your basket"}
        </h2>
        <p className="mt-1 text-sm text-ink-faint">
          Type the coins by ticker, set what share of a budget each one takes, and publish it for other people to
          copy. No wallet connection, no order is ever placed.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-danger/50 px-4 py-3 text-sm text-danger" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className={panel}>
        <h3 className="text-base font-semibold">Coins and weights</h3>
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((row, index) => (
            <li className="flex flex-wrap items-end gap-2 sm:flex-nowrap" key={index}>
              <div className="w-28 shrink-0">
                <label className={label} htmlFor={`ticker-${index}`}>
                  Ticker {index + 1}
                </label>
                <input
                  autoCapitalize="characters"
                  className={`${input} mt-1 font-mono uppercase`}
                  id={`ticker-${index}`}
                  onChange={(e) => setRow(index, { ticker: e.target.value })}
                  placeholder="DOGE"
                  value={row.ticker}
                />
              </div>
              <div className="min-w-32 flex-1">
                <label className={label} htmlFor={`name-${index}`}>
                  Name (optional)
                </label>
                <input
                  className={`${input} mt-1`}
                  id={`name-${index}`}
                  onChange={(e) => setRow(index, { name: e.target.value })}
                  placeholder="Dogecoin"
                  value={row.name}
                />
              </div>
              <div className="w-24 shrink-0">
                <label className={label} htmlFor={`weight-${index}`}>
                  Weight %
                </label>
                <input
                  className={`${input} mt-1 font-mono tabular-nums`}
                  id={`weight-${index}`}
                  inputMode="numeric"
                  max="100"
                  min="0"
                  onChange={(e) => setRow(index, { weight: e.target.value })}
                  placeholder="25"
                  type="number"
                  value={row.weight}
                />
              </div>
              <button
                aria-label={`Remove coin ${index + 1}${row.ticker ? ` (${cleanTicker(row.ticker)})` : ""}`}
                className={`${btnGhost} px-3`}
                disabled={rows.length <= 2}
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className={btnGhost}
            disabled={rows.length >= MAX_COINS}
            onClick={() => setRows((current) => [...current, { ticker: "", name: "", weight: "" }])}
            type="button"
          >
            Add coin
          </button>
          <button className={btnGhost} disabled={filled.length === 0} onClick={evenSplit} type="button">
            Even split
          </button>
          <button className={btnGhost} disabled={filled.length === 0} onClick={scaleTo100} type="button">
            Scale to 100%
          </button>
          <span
            className={`ml-auto rounded-lg px-3 py-2 font-mono text-sm tabular-nums ${
              total === 100 ? "bg-accent/15 text-accent" : "bg-panel-2 text-warn"
            }`}
            data-testid="weight-total"
            role="status"
          >
            {total}% of 100%
          </span>
        </div>
        {duplicate ? (
          <p className="mt-3 text-sm text-warn" role="alert">
            One ticker is listed twice — each coin needs its own row.
          </p>
        ) : null}
        <div className="mt-6 border-t border-edge/60 pt-5">
          <WeightBreakdown tokens={tokens} />
        </div>
      </div>

      <div className={panel}>
        <h3 className="text-base font-semibold">Theme</h3>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className={label} htmlFor="basket-title">
              Title
            </label>
            <input
              className={`${input} mt-1`}
              id="basket-title"
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dog Coins"
              value={title}
            />
          </div>
          <div>
            <label className={label} htmlFor="basket-description">
              Description
            </label>
            <textarea
              className={`${input} mt-1 min-h-24`}
              id="basket-description"
              maxLength={600}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What ties these coins together and why these weights?"
              value={description}
            />
          </div>
          <div>
            <label className={label} htmlFor="basket-rationale">
              Weight rationale (optional)
            </label>
            <input
              className={`${input} mt-1`}
              id="basket-rationale"
              maxLength={400}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Older coins carry more weight."
              value={rationale}
            />
          </div>
          <div>
            <label className={label} htmlFor="basket-tags">
              Tags (comma separated, up to 6)
            </label>
            <input
              className={`${input} mt-1`}
              id="basket-tags"
              onChange={(e) => setTags(e.target.value)}
              placeholder="dogs, equal-weight"
              value={tags}
            />
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">AI assistant</h3>
          <span className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs text-ink-dim">Pro</span>
        </div>
        <p className="mt-1 text-sm text-ink-faint">
          Say what you want from the split and the assistant drafts a title, a description and the weights. Its output
          is a suggestion, not advice — you review it before it touches your basket.
        </p>

        {pro ? (
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className={label} htmlFor="assist-goal">
                Your goal for this basket
              </label>
              <input
                className={`${input} mt-1`}
                id="assist-goal"
                maxLength={200}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="equal weight, but the two oldest coins get more"
                value={goal}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className={btnPrimary}
                disabled={assisting || filled.length < 2}
                onClick={() => void runAssist()}
                type="button"
              >
                {assisting ? "Thinking…" : "Suggest a theme and split"}
              </button>
              {filled.length < 2 ? <span className="text-xs text-ink-faint">Add 2 coins first.</span> : null}
            </div>
            {assistError ? (
              <p className="text-sm text-danger" role="alert">
                {assistError}
              </p>
            ) : null}
            {suggestion ? (
              <div className="rounded-xl border border-accent/40 bg-accent/5 p-4" data-testid="suggestion">
                <p className="text-sm font-semibold">{suggestion.title}</p>
                <p className="mt-2 text-sm text-ink-dim">{suggestion.description}</p>
                {suggestion.rationale ? <p className="mt-2 text-xs text-ink-faint">{suggestion.rationale}</p> : null}
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {(suggestion.weights ?? []).map((w) => (
                    <li className="rounded-md bg-panel-2 px-2 py-0.5 font-mono tabular-nums" key={w.ticker}>
                      {w.ticker} {w.weight}%
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className={btnPrimary} onClick={applySuggestion} type="button">
                    Apply to my basket
                  </button>
                  <button className={btnGhost} onClick={() => setSuggestion(null)} type="button">
                    Discard
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <ProUnlock compact />
          </div>
        )}
      </div>

      <div className={panel}>
        <h3 className="text-base font-semibold">Publish</h3>
        {user ? (
          <>
            <p className="mt-1 text-sm text-ink-faint">
              Published baskets appear in the public gallery under your name. You can edit or delete them later.
            </p>
            <button className={`${btnPrimary} mt-4`} disabled={saving} onClick={() => void publish()} type="button">
              {saving ? "Publishing…" : loadedId === undefined ? "Publish basket" : "Save changes"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-faint">
              The builder and the calculator work without an account. Log in to publish this basket to the gallery —
              free accounts keep 2.
            </p>
            <div className="mt-4" data-testid="publish-login">
              <LoginButton className={btnPrimary}>Log in to publish</LoginButton>
            </div>
          </>
        )}
        {saveError ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {saveError}
          </p>
        ) : null}
        {hitLimit ? (
          <div className="mt-4">
            <ProUnlock compact />
          </div>
        ) : null}
      </div>
    </section>
  );
}
