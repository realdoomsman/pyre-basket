/**
 * LLM basket assistant: turns a token list plus a one-line goal into a title, a
 * one-paragraph description, a rationale and a weight split that sums to 100.
 *
 * Requires the Basket Pro entitlement (`ent:<uid>`) or holding the app's coin, and
 * caps each user at DAILY_CAP calls a day because every call spends build budget.
 *
 * @param {unknown} input
 * @param {{ kv: { get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<void> }, user: { id: string|null, isHolder: boolean }, llm(prompt: string, opts?: { maxTokens?: number }): Promise<string> }} ship
 */

const DAILY_CAP = 25;

function uidKey(id) {
  return id.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 60);
}

/** @param {unknown} v */
function str(v) {
  return typeof v === "string" ? v : "";
}

/** Largest-remainder rounding so integer weights always total exactly 100. */
function toHundred(rows) {
  const positive = rows.map((r) => ({ ticker: r.ticker, weight: Math.max(0, Number(r.weight) || 0) }));
  const sum = positive.reduce((acc, r) => acc + r.weight, 0);
  const scaled =
    sum > 0
      ? positive.map((r) => ({ ticker: r.ticker, exact: (r.weight * 100) / sum }))
      : positive.map((r) => ({ ticker: r.ticker, exact: 100 / positive.length }));
  const floored = scaled.map((r) => ({ ticker: r.ticker, weight: Math.floor(r.exact), rest: r.exact % 1 }));
  let left = 100 - floored.reduce((acc, r) => acc + r.weight, 0);
  floored.sort((a, b) => b.rest - a.rest);
  for (let i = 0; i < floored.length && left > 0; i += 1, left -= 1) floored[i].weight += 1;
  // Nothing may end at 0% — steal from the largest slice.
  for (const row of floored) {
    if (row.weight === 0) {
      const biggest = floored.reduce((a, b) => (b.weight > a.weight ? b : a), floored[0]);
      if (biggest.weight > 1) {
        biggest.weight -= 1;
        row.weight = 1;
      }
    }
  }
  return floored.map((r) => ({ ticker: r.ticker, weight: r.weight }));
}

function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default async function handler(input, ship) {
  const uid = ship.user && typeof ship.user.id === "string" ? ship.user.id : null;
  if (uid === null) return { ok: false, reason: "auth", error: "Log in to use the assistant." };

  const key = uidKey(uid);
  const entitlement = await ship.kv.get(`ent:${key}`);
  const paid = entitlement !== null && typeof entitlement === "object";
  if (!paid && ship.user.isHolder !== true) {
    return { ok: false, reason: "locked", error: "The assistant is part of Basket Pro." };
  }

  const req = input && typeof input === "object" ? input : {};
  const tickers = [];
  for (const raw of Array.isArray(req.tokens) ? req.tokens : []) {
    const row = raw && typeof raw === "object" ? raw : {};
    const ticker = str(row.ticker).trim().toUpperCase().replace(/^\$/, "").slice(0, 12);
    if (ticker !== "" && /^[A-Z0-9._-]+$/.test(ticker) && tickers.indexOf(ticker) === -1) tickers.push(ticker);
    if (tickers.length >= 12) break;
  }
  if (tickers.length < 2) return { ok: false, reason: "invalid", error: "Add at least 2 coins first." };

  const goal = str(req.goal).trim().replace(/\s+/g, " ").slice(0, 200) || "equal weight";

  const day = new Date().toISOString().slice(0, 10);
  const usageKey = `llm:${key}:${day}`;
  const used = await ship.kv.get(usageKey);
  const count = typeof used === "number" && Number.isFinite(used) ? used : 0;
  if (count >= DAILY_CAP) {
    return { ok: false, reason: "rate", error: `You have used today's ${DAILY_CAP} assistant runs. Try again tomorrow.` };
  }
  await ship.kv.set(usageKey, count + 1);

  const prompt = [
    "You help someone draft a themed memecoin basket: a weighted shopping list, not a traded product.",
    `Coins, by ticker: ${tickers.join(", ")}.`,
    `Their goal for the split: "${goal}".`,
    "Reply with JSON only, no prose and no markdown fence, shaped exactly like:",
    '{"title":"","description":"","rationale":"","weights":[{"ticker":"","weight":0}]}',
    "Rules: title is 2-4 words and concrete; description is one paragraph of 2-3 sentences describing the theme;",
    "rationale is one sentence explaining the split; weights covers every ticker above exactly once with positive",
    "integers summing to 100, ordered largest first. Never promise returns, never give financial advice, and do not",
    "mention prices or market caps as if you had live data.",
  ].join("\n");

  let raw;
  try {
    raw = await ship.llm(prompt, { maxTokens: 700 });
  } catch (cause) {
    return { ok: false, reason: "llm", error: `The assistant could not be reached: ${String(cause && cause.message ? cause.message : cause)}` };
  }

  const parsed = parseJson(str(raw));
  if (parsed === null) return { ok: false, reason: "llm", error: "The assistant returned something unreadable. Try again." };

  const byTicker = {};
  for (const raw2 of Array.isArray(parsed.weights) ? parsed.weights : []) {
    const row = raw2 && typeof raw2 === "object" ? raw2 : {};
    const ticker = str(row.ticker).trim().toUpperCase().replace(/^\$/, "");
    if (tickers.indexOf(ticker) !== -1) byTicker[ticker] = Number(row.weight) || 0;
  }
  const weights = toHundred(tickers.map((t) => ({ ticker: t, weight: byTicker[t] ?? 0 })));

  return {
    ok: true,
    title: str(parsed.title).trim().slice(0, 60),
    description: str(parsed.description).trim().slice(0, 600),
    rationale: str(parsed.rationale).trim().slice(0, 400),
    weights,
    runsLeft: Math.max(0, DAILY_CAP - (count + 1)),
  };
}
