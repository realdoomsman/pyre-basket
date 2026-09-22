/**
 * Creates or updates a basket owned by the logged-in user. Only writer of
 * `catalog`, `basket:<id>` and `u:<uid>:ids`.
 *
 * Free accounts keep 2 baskets; the $8 Basket Pro unlock (`ent:<uid>`) or holding
 * the app's coin (`ship.user.isHolder`) lifts the cap. Holder baskets get the
 * featured flag the gallery sorts on.
 *
 * @param {unknown} input
 * @param {{ kv: { get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<void> }, user: { id: string|null, isHolder: boolean } }} ship
 */

const FREE_LIMIT = 2;
const CATALOG_CAP = 120;
const MAX_TOKENS = 12;

/** @param {unknown} v */
function str(v) {
  return typeof v === "string" ? v : "";
}

/** kv keys allow `[A-Za-z0-9_.:-]`, user ids may not. */
function uidKey(id) {
  return id.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 60);
}

function slugId(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base === "" ? "basket" : base}-${rand}`;
}

/** Validates the token rows: 2–12 rows, unique tickers, integer weights summing to 100. */
function normalizeTokens(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const seen = {};
  const tokens = [];
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const ticker = str(row.ticker).trim().toUpperCase().replace(/^\$/, "").slice(0, 12);
    if (ticker === "" || !/^[A-Z0-9._-]+$/.test(ticker)) continue;
    if (seen[ticker]) return { error: `${ticker} is listed twice — each coin needs one row.` };
    seen[ticker] = true;
    const weight = Math.round(Number(row.weight));
    if (!Number.isFinite(weight) || weight <= 0) return { error: `Give ${ticker} a weight above 0%.` };
    tokens.push({ ticker, name: str(row.name).trim().slice(0, 40), weight });
  }
  if (tokens.length < 2) return { error: "A basket needs at least 2 coins." };
  if (tokens.length > MAX_TOKENS) return { error: `A basket holds at most ${MAX_TOKENS} coins.` };
  const sum = tokens.reduce((acc, t) => acc + t.weight, 0);
  if (sum !== 100) return { error: `Weights add up to ${sum}% — they must total exactly 100%.` };
  return { tokens };
}

export default async function handler(input, ship) {
  const uid = ship.user && typeof ship.user.id === "string" ? ship.user.id : null;
  if (uid === null) return { ok: false, reason: "auth", error: "Log in to publish a basket." };

  const req = input && typeof input === "object" ? input : {};
  const title = str(req.title).trim().replace(/\s+/g, " ").slice(0, 60);
  const description = str(req.description).trim().slice(0, 600);
  const rationale = str(req.rationale).trim().slice(0, 400);
  if (title.length < 3) return { ok: false, reason: "invalid", error: "Give the basket a title (3+ characters)." };
  if (description.length < 10) {
    return { ok: false, reason: "invalid", error: "Add a short description (10+ characters)." };
  }

  const tags = [];
  for (const raw of Array.isArray(req.tags) ? req.tags : []) {
    const tag = str(raw)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20);
    if (tag !== "" && tags.indexOf(tag) === -1 && tags.length < 6) tags.push(tag);
  }

  const parsed = normalizeTokens(req.tokens);
  if (parsed.error) return { ok: false, reason: "invalid", error: parsed.error };

  const key = uidKey(uid);
  const storedIds = await ship.kv.get(`u:${key}:ids`);
  const ids = (Array.isArray(storedIds) ? storedIds : []).filter((v) => typeof v === "string");
  const entitlement = await ship.kv.get(`ent:${key}`);
  const isHolder = ship.user.isHolder === true;
  const unlimited = isHolder || (entitlement !== null && typeof entitlement === "object");

  const editing = typeof req.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(req.id) ? req.id : null;
  if (editing !== null && ids.indexOf(editing) === -1) {
    return { ok: false, reason: "invalid", error: "That basket is not yours to edit." };
  }
  if (editing === null && !unlimited && ids.length >= FREE_LIMIT) {
    return {
      ok: false,
      reason: "limit",
      error: `Free accounts keep ${FREE_LIMIT} baskets. Unlock Basket Pro for unlimited baskets.`,
    };
  }

  const now = new Date().toISOString();
  const id = editing ?? slugId(title);
  const previous = editing === null ? null : await ship.kv.get(`basket:${id}`);
  const createdAt =
    previous !== null && typeof previous === "object" && typeof previous.createdAt === "string"
      ? previous.createdAt
      : now;

  const creatorName = str(req.creatorName).trim().slice(0, 40) || `anon-${key.slice(0, 4)}`;
  const record = {
    id,
    title,
    description,
    rationale,
    tags,
    tokens: parsed.tokens,
    creatorId: uid,
    creatorName,
    featured: isHolder,
    createdAt,
    updatedAt: now,
  };
  await ship.kv.set(`basket:${id}`, record);

  if (ids.indexOf(id) === -1) {
    ids.unshift(id);
    await ship.kv.set(`u:${key}:ids`, ids.slice(0, 200));
  }

  const storedCatalog = await ship.kv.get("catalog");
  const catalog = (Array.isArray(storedCatalog) ? storedCatalog : []).filter(
    (entry) => entry !== null && typeof entry === "object" && entry.id !== id,
  );
  catalog.unshift({
    id,
    title,
    description: description.slice(0, 160),
    tags,
    tokens: parsed.tokens.map((t) => ({ ticker: t.ticker, weight: t.weight })),
    creatorName,
    featured: isHolder,
    createdAt,
  });
  await ship.kv.set("catalog", catalog.slice(0, CATALOG_CAP));

  return { ok: true, basket: record, count: ids.length, unlimited };
}
