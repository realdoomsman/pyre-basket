/**
 * One basket by id, for the detail page. Free, no login.
 *
 * @param {unknown} input
 * @param {{ kv: { get(key: string): Promise<unknown> }, user: { id: string|null } }} ship
 */

/** Read-only starter baskets. Mirrored in gallery.js — keep both copies in sync. */
const SEEDS = {
  "demo-dog-coins": {
    id: "demo-dog-coins",
    title: "Dog Coins",
    description:
      "The original dog-themed memecoins, weighted toward the two with the longest track record. A starting point for anyone who wants canine exposure without picking a single winner.",
    rationale:
      "DOGE and SHIB carry most of the weight because they have survived several cycles; the rest are smaller, higher-variance bets.",
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
    createdAt: "2026-01-05T00:00:00.000Z",
  },
  "demo-frog-pond": {
    id: "demo-frog-pond",
    title: "Frog Pond",
    description:
      "Amphibian-branded coins in one list, led by the meme that started the category. Equal-ish weights below the leader keep any single frog from dominating the basket.",
    rationale:
      "PEPE is the category leader, so it takes the largest slice; the remainder is split evenly across the smaller frogs.",
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
    createdAt: "2026-01-04T00:00:00.000Z",
  },
  "demo-equal-five": {
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
    createdAt: "2026-01-03T00:00:00.000Z",
  },
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(input, ship) {
  const id = input && typeof input === "object" && typeof input.id === "string" ? input.id : "";
  if (!ID.test(id)) return { basket: null, error: "That basket id does not look right." };

  const seed = SEEDS[id];
  if (seed) return { basket: { ...seed, demo: true, mine: false } };

  const stored = await ship.kv.get(`basket:${id}`);
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
    return { basket: null, error: "This basket no longer exists." };
  }
  const uid = ship.user && typeof ship.user.id === "string" ? ship.user.id : null;
  return { basket: { ...stored, demo: false, mine: uid !== null && stored.creatorId === uid } };
}
