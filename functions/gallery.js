/**
 * Public basket gallery: search / filter / sort. Free, no login.
 *
 * Storage layout (app scope, written by publish.js):
 *   catalog            array of card summaries, newest first, capped at 200
 *   basket:<id>        the full record (description, rationale, tokens)
 *
 * @param {unknown} input
 * @param {{ kv: { get(key: string): Promise<unknown> } }} ship
 */

/** Read-only starter baskets so the gallery is never empty. Mirrored in basket.js. */
const SEEDS = [
  {
    id: "demo-dog-coins",
    title: "Dog Coins",
    description:
      "The original dog-themed memecoins, weighted toward the two with the longest track record. A starting point for anyone who wants canine exposure without picking a single winner.",
    rationale: "DOGE and SHIB carry most of the weight because they have survived several cycles; the rest are smaller, higher-variance bets.",
    tags: ["dogs", "classics"],
    tokens: [
      { ticker: "DOGE", name: "Dogecoin", weight: 40 },
      { ticker: "SHIB", name: "Shiba Inu", weight: 25 },
      { ticker: "WIF", name: "dogwifhat", weight: 20 },
      { ticker: "BONK", name: "Bonk", weight: 15 },
    ],
    creatorName: "Basket",
    creatorId: null,
    featured: true,
    demo: true,
    createdAt: "2026-01-05T00:00:00.000Z",
  },
  {
    id: "demo-frog-pond",
    title: "Frog Pond",
    description:
      "Amphibian-branded coins in one list, led by the meme that started the category. Equal-ish weights below the leader keep any single frog from dominating the basket.",
    rationale: "PEPE is the category leader, so it takes the largest slice; the remainder is split evenly across the smaller frogs.",
    tags: ["frogs", "equal-weight"],
    tokens: [
      { ticker: "PEPE", name: "Pepe", weight: 50 },
      { ticker: "BRETT", name: "Brett", weight: 20 },
      { ticker: "WOJAK", name: "Wojak", weight: 15 },
      { ticker: "TOAD", name: "Toad", weight: 15 },
    ],
    creatorName: "Basket",
    creatorId: null,
    featured: true,
    demo: true,
    createdAt: "2026-01-04T00:00:00.000Z",
  },
  {
    id: "demo-equal-five",
    title: "Equal Five",
    description:
      "Five large memecoins at 20% each. No thesis beyond diversification: if you have no opinion on which meme wins, this is the flat version of the trade.",
    rationale: "Equal weight avoids concentration in whichever coin happens to be pumping the week you buy.",
    tags: ["equal-weight", "bluechip"],
    tokens: [
      { ticker: "DOGE", name: "Dogecoin", weight: 20 },
      { ticker: "PEPE", name: "Pepe", weight: 20 },
      { ticker: "SHIB", name: "Shiba Inu", weight: 20 },
      { ticker: "BONK", name: "Bonk", weight: 20 },
      { ticker: "FLOKI", name: "Floki", weight: 20 },
    ],
    creatorName: "Basket",
    creatorId: null,
    featured: false,
    demo: true,
    createdAt: "2026-01-03T00:00:00.000Z",
  },
];

/** @param {unknown} v */
function str(v) {
  return typeof v === "string" ? v : "";
}

/** @param {unknown} v */
function card(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const id = str(v.id);
  const title = str(v.title);
  if (id === "" || title === "") return null;
  const tokens = (Array.isArray(v.tokens) ? v.tokens : [])
    .map((t) =>
      t && typeof t === "object"
        ? { ticker: str(t.ticker), name: str(t.name), weight: Number(t.weight) || 0 }
        : null,
    )
    .filter((t) => t !== null && t.ticker !== "");
  return {
    id,
    title,
    description: str(v.description),
    tags: (Array.isArray(v.tags) ? v.tags : []).map(str).filter((t) => t !== ""),
    tokens,
    creatorName: str(v.creatorName) || "anon",
    featured: v.featured === true,
    demo: v.demo === true,
    createdAt: str(v.createdAt),
  };
}

export default async function handler(input, ship) {
  const req = input && typeof input === "object" ? input : {};
  const q = str(req.q).trim().toLowerCase().slice(0, 60);
  const tag = str(req.tag).trim().toLowerCase().slice(0, 40);
  const sort = req.sort === "featured" ? "featured" : "newest";

  const stored = await ship.kv.get("catalog");
  const published = (Array.isArray(stored) ? stored : []).map(card).filter((c) => c !== null);
  const all = published.concat(SEEDS.map(card).filter((c) => c !== null));

  const tagCounts = {};
  for (const b of all) for (const t of b.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
  const tags = Object.keys(tagCounts)
    .sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b))
    .slice(0, 16);

  let items = all;
  if (tag !== "") items = items.filter((b) => b.tags.some((t) => t.toLowerCase() === tag));
  if (q !== "") {
    items = items.filter((b) => {
      const haystack = [
        b.title,
        b.description,
        b.creatorName,
        b.tags.join(" "),
        b.tokens.map((t) => `${t.ticker} ${t.name}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  if (sort === "featured") items.sort((a, b) => Number(b.featured) - Number(a.featured));

  return {
    items: items.slice(0, 60).map((b) => ({
      id: b.id,
      title: b.title,
      blurb: b.description.slice(0, 160),
      tags: b.tags,
      tokens: b.tokens.map((t) => ({ ticker: t.ticker, weight: t.weight })),
      creatorName: b.creatorName,
      featured: b.featured,
      createdAt: b.createdAt,
    })),
    total: items.length,
    tags,
  };
}
