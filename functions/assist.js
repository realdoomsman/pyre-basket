/**
 * Holder perk: turns the basket's legs plus a one-line goal into a title, a description, a
 * rationale and a weight split that sums to 100. Declared `auth: true, holderOnly: true`, so the
 * platform answers 401/403 before this runs; the checks below cover hosts that do not enforce it.
 *
 * Every call spends build budget, so each user gets DAILY_CAP runs a day (`llm:<uid>:<day>`).
 *
 * @param {unknown} input
 * @param {{ kv: { get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<void> }, user: { id: string|null, isHolder: boolean }, llm(prompt: string, opts?: { maxTokens?: number }): Promise<string> }} ship
 */

const DAILY_CAP = 25;
const MAX_LEGS = 12;
const TICKER = /^[A-Z0-9][A-Z0-9._-]{0,11}$/;

function uidKey(id) {
  return id.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 60);
}

/** @param {unknown} v */
function str(v) {
  return typeof v === "string" ? v : "";
}

/** Largest-remainder rounding so integer weights always total exactly 100, none at 0. */
function toHundred(rows) {
  const positive = rows.map((r) => ({ ticker: r.ticker, weight: Math.max(0, Number(r.weight) || 0) }));
  const sum = positive.reduce((acc, r) => acc + r.weight, 0);
  const scaled = positive.map((r) => ({ ticker: r.ticker, exact: sum > 0 ? (r.weight * 100) / sum : 100 / positive.length }));
  const floored = scaled.map((r) => ({ ticker: r.ticker, weight: Math.floor(r.exact), rest: r.exact % 1 }));
  let left = 100 - floored.reduce((acc, r) => acc + r.weight, 0);
  const order = [...floored].sort((a, b) => b.rest - a.rest);
  for (let i = 0; i < order.length && left > 0; i += 1, left -= 1) order[i].weight += 1;
  for (const row of floored) {
    if (row.weight > 0) continue;
    const biggest = floored.reduce((a, b) => (b.weight > a.weight ? b : a), floored[0]);
    if (biggest.weight > 1) {
      biggest.weight -= 1;
      row.weight = 1;
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
  if (uid === null) return { ok: false, reason: "auth", error: "Sign in to use the assistant." };
  if (ship.user.isHolder !== true) return { ok: false, reason: "holder", error: "The assistant is a holder perk." };

  const req = input && typeof input === "object" ? input : {};
  const tickers = [];
  for (const raw of Array.isArray(req.tokens) ? req.tokens : []) {
    const row = raw && typeof raw === "object" ? raw : {};
    const ticker = str(row.ticker).trim().toUpperCase().replace(/^\$/, "").slice(0, 12);
    if (TICKER.test(ticker) && tickers.indexOf(ticker) === -1) tickers.push(ticker);
    if (tickers.length >= MAX_LEGS) break;
  }
  if (tickers.length < 2) return { ok: false, reason: "invalid", error: "Add at least 2 legs first." };

  const goal = str(req.goal).trim().replace(/\s+/g, " ").slice(0, 200) || "a sensible split";

  const key = uidKey(uid);
  const day = new Date().toISOString().slice(0, 10);
  const usageKey = `llm:${key}:${day}`;
  const used = await ship.kv.get(usageKey);
  const count = typeof used === "number" && Number.isFinite(used) ? used : 0;
  if (count >= DAILY_CAP) {
    return { ok: false, reason: "rate", error: `You have used today's ${DAILY_CAP} assistant runs. Try again tomorrow.` };
  }
  await ship.kv.set(usageKey, count + 1);

  const prompt = [
    "You help someone draft a weighted basket of coins launched on Pyre: a shopping list with percentages, not a traded product.",
    `Legs, by ticker: ${tickers.join(", ")}.`,
    `Their goal for the split: "${goal}".`,
    "Reply with JSON only, no prose and no markdown fence, shaped exactly like:",
    '{"title":"","description":"","rationale":"","weights":[{"ticker":"","weight":0}]}',
    "Rules: title is 2-4 words, concrete, no exclamation marks; description is one paragraph of 2-3 calm sentences",
    "describing the theme; rationale is one sentence explaining the split; weights covers every ticker above exactly",
    "once with positive integers summing to 100, ordered largest first. Never promise returns, never give financial",
    "advice, never use emoji, and do not mention prices or market caps as if you had live data.",
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
  for (const item of Array.isArray(parsed.weights) ? parsed.weights : []) {
    const row = item && typeof item === "object" ? item : {};
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
