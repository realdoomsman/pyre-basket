/**
 * Creates or updates a basket owned by the signed-in user. The only writer of `catalog`,
 * `basket:<id>` and `u:<uid>:ids`.
 *
 * Storage (app scope):
 *   catalog        card summaries, newest first, trimmed to stay under the 64 KB value cap
 *   basket:<id>    the full record
 *   u:<uid>:ids    the user's basket ids, newest first
 *
 * Free accounts keep FREE_LIMIT baskets; holders of the app's coin (`ship.user.isHolder`) keep
 * as many as they like and their baskets carry the `featured` flag the gallery sorts on.
 *
 * Legs are coins launched on Pyre, keyed by slug. The browser resolves live prices from
 * `/_pyre/coins`; nothing price-related is stored here.
 *
 * @param {unknown} input
 * @param {{ kv: { get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<void> }, user: { id: string|null, isHolder: boolean } }} ship
 */

const FREE_LIMIT = 3;
const MIN_LEGS = 2;
const MAX_LEGS = 12;
const MAX_TAGS = 6;
/** Leaves headroom under the 64 KB kv value cap for the JSON overhead. */
const CATALOG_BYTES = 56 * 1024;
const CATALOG_MAX = 200;

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TICKER = /^[A-Z0-9][A-Z0-9._-]{0,11}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** @param {unknown} v */
function str(v) {
  return typeof v === "string" ? v : "";
}

/** kv keys allow `[A-Za-z0-9_.:-]`; user ids may not. */
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

/** Validates the legs: 2–12 rows, unique slugs, integer weights ≥ 1 summing to 100. */
function parseTokens(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const seen = {};
  const tokens = [];
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const slug = str(row.slug).trim().toLowerCase();
    if (!SLUG.test(slug)) return { error: "One of the legs is not a coin on Pyre." };
    if (seen[slug]) return { error: `${slug} is listed twice; each coin needs one leg.` };
    seen[slug] = true;
    const ticker = str(row.ticker).trim().toUpperCase().replace(/^\$/, "").slice(0, 12);
    if (!TICKER.test(ticker)) return { error: `${slug} has no usable ticker.` };
    const weight = Math.round(Number(row.weight));
    if (!Number.isFinite(weight) || weight < 1) return { error: `Give ${ticker} a weight of 1% or more.` };
    const address = str(row.tokenAddress).trim();
    tokens.push({
      slug,
      ticker,
      name: str(row.name).trim().slice(0, 60),
      tokenAddress: ADDRESS.test(address) ? address : "",
      weight,
    });
  }
  if (tokens.length < MIN_LEGS) return { error: `A basket needs at least ${MIN_LEGS} legs.` };
  if (tokens.length > MAX_LEGS) return { error: `A basket holds at most ${MAX_LEGS} legs.` };
  const sum = tokens.reduce((acc, t) => acc + t.weight, 0);
  if (sum !== 100) return { error: `Weights add up to ${sum}%; they must total exactly 100%.` };
  return { tokens };
}

function parseTags(raw) {
  const tags = [];
  for (const value of Array.isArray(raw) ? raw : []) {
    const tag = str(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20);
    // "auto" marks baskets the client derives from live data; a published one may not claim it.
    if (tag !== "" && tag !== "auto" && tags.indexOf(tag) === -1 && tags.length < MAX_TAGS) tags.push(tag);
  }
  return tags;
}

/** Newest first, capped by count and by serialized size so the value never exceeds the kv cap. */
function trimCatalog(catalog) {
  let list = catalog.slice(0, CATALOG_MAX);
  while (list.length > 0 && JSON.stringify(list).length > CATALOG_BYTES) list = list.slice(0, -1);
  return list;
}

export default async function handler(input, ship) {
  const uid = ship.user && typeof ship.user.id === "string" ? ship.user.id : null;
  if (uid === null) return { ok: false, reason: "auth", error: "Sign in to publish a basket." };

  const req = input && typeof input === "object" ? input : {};
  const title = str(req.title).trim().replace(/\s+/g, " ").slice(0, 60);
  const description = str(req.description).trim().slice(0, 600);
  const rationale = str(req.rationale).trim().slice(0, 400);
  if (title.length < 3) return { ok: false, reason: "invalid", error: "Give the basket a title (3+ characters)." };
  if (description.length < 10) return { ok: false, reason: "invalid", error: "Add a short description (10+ characters)." };

  const parsed = parseTokens(req.tokens);
  if (parsed.error) return { ok: false, reason: "invalid", error: parsed.error };
  const tags = parseTags(req.tags);

  const key = uidKey(uid);
  const storedIds = await ship.kv.get(`u:${key}:ids`);
  const ids = (Array.isArray(storedIds) ? storedIds : []).filter((v) => typeof v === "string");
  const isHolder = ship.user.isHolder === true;

  const editing = typeof req.id === "string" && ID.test(req.id) ? req.id : null;
  if (editing !== null && ids.indexOf(editing) === -1) {
    return { ok: false, reason: "invalid", error: "That basket is not yours to edit." };
  }
  if (editing === null && !isHolder && ids.length >= FREE_LIMIT) {
    return {
      ok: false,
      reason: "limit",
      error: `Free accounts keep ${FREE_LIMIT} baskets. Delete one, or hold the coin for unlimited baskets.`,
      count: ids.length,
      freeLimit: FREE_LIMIT,
      unlimited: false,
    };
  }

  const now = new Date().toISOString();
  const id = editing ?? slugId(title);
  const previous = editing === null ? null : await ship.kv.get(`basket:${id}`);
  const createdAt = previous !== null && typeof previous === "object" && typeof previous.createdAt === "string" ? previous.createdAt : now;
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
    await ship.kv.set(`u:${key}:ids`, ids.slice(0, CATALOG_MAX));
  }

  const storedCatalog = await ship.kv.get("catalog");
  const catalog = (Array.isArray(storedCatalog) ? storedCatalog : []).filter((entry) => entry !== null && typeof entry === "object" && entry.id !== id);
  catalog.unshift({
    id,
    title,
    blurb: description.slice(0, 160),
    tags,
    tokens: parsed.tokens.map((t) => ({ slug: t.slug, ticker: t.ticker, weight: t.weight })),
    creatorName,
    featured: isHolder,
    createdAt,
  });
  await ship.kv.set("catalog", trimCatalog(catalog));

  return {
    ok: true,
    basket: { ...record, auto: false, mine: true },
    count: ids.length,
    freeLimit: FREE_LIMIT,
    unlimited: isHolder,
  };
}
