/**
 * Public basket catalog for the gallery. Free, no sign-in. Returns every published card, newest
 * first, plus the tag list; the browser filters, sorts and joins live coin data, and adds the
 * "auto" baskets it derives from `/_pyre/coins`.
 *
 * Storage (app scope, written by publish.js / remove.js):
 *   catalog        array of card summaries, newest first
 *
 * @param {unknown} _input
 * @param {{ kv: { get(key: string): Promise<unknown> } }} ship
 */

const MAX_ITEMS = 120;
const MAX_TAGS = 24;

/** @param {unknown} v */
function str(v) {
  return typeof v === "string" ? v : "";
}

/** Drops anything malformed so one bad record can never blank the gallery. */
function card(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const id = str(v.id);
  const title = str(v.title);
  if (id === "" || title === "") return null;
  const tokens = (Array.isArray(v.tokens) ? v.tokens : [])
    .map((t) => (t && typeof t === "object" ? { slug: str(t.slug), ticker: str(t.ticker), weight: Math.round(Number(t.weight)) || 0 } : null))
    .filter((t) => t !== null && t.slug !== "" && t.ticker !== "" && t.weight > 0);
  if (tokens.length < 2) return null;
  return {
    id,
    title,
    blurb: str(v.blurb).slice(0, 160),
    tags: (Array.isArray(v.tags) ? v.tags : []).map(str).filter((t) => t !== ""),
    tokens,
    creatorName: str(v.creatorName) || "anon",
    featured: v.featured === true,
    auto: false,
    createdAt: str(v.createdAt),
  };
}

export default async function handler(_input, ship) {
  const stored = await ship.kv.get("catalog");
  const items = (Array.isArray(stored) ? stored : []).map(card).filter((c) => c !== null);
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const counts = {};
  for (const item of items) for (const tag of item.tags) counts[tag] = (counts[tag] || 0) + 1;
  const tags = Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))
    .slice(0, MAX_TAGS);

  return { items: items.slice(0, MAX_ITEMS), total: items.length, tags };
}
