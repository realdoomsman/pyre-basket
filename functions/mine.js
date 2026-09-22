/**
 * The signed-in user's own baskets plus their allowance. Declared `auth: true`, so the platform
 * answers 401 before this runs for anonymous callers; the `reason: "auth"` branch covers hosts
 * that do not enforce it (the local dev host).
 *
 * @param {unknown} _input
 * @param {{ kv: { get(k: string): Promise<unknown> }, user: { id: string|null, isHolder: boolean } }} ship
 */

const FREE_LIMIT = 3;

function uidKey(id) {
  return id.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 60);
}

export default async function handler(_input, ship) {
  const uid = ship.user && typeof ship.user.id === "string" ? ship.user.id : null;
  if (uid === null) {
    return { ok: false, reason: "auth", baskets: [], freeLimit: FREE_LIMIT, unlimited: false, isHolder: false, remaining: FREE_LIMIT };
  }
  const key = uidKey(uid);
  const storedIds = await ship.kv.get(`u:${key}:ids`);
  const ids = (Array.isArray(storedIds) ? storedIds : []).filter((v) => typeof v === "string").slice(0, 100);

  const baskets = [];
  for (const id of ids) {
    const record = await ship.kv.get(`basket:${id}`);
    if (record !== null && typeof record === "object" && !Array.isArray(record)) baskets.push({ ...record, auto: false, mine: true });
  }

  const isHolder = ship.user.isHolder === true;
  return {
    ok: true,
    baskets,
    freeLimit: FREE_LIMIT,
    unlimited: isHolder,
    isHolder,
    remaining: isHolder ? null : Math.max(0, FREE_LIMIT - baskets.length),
  };
}
