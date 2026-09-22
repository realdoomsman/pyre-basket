/**
 * One published basket by id, for the detail page and the editor. Free, no sign-in. The "auto"
 * baskets (`auto-*`) are derived in the browser from live coin data and never stored, so they
 * are not served here.
 *
 * @param {unknown} input
 * @param {{ kv: { get(key: string): Promise<unknown> }, user: { id: string|null } }} ship
 */

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(input, ship) {
  const id = input && typeof input === "object" && typeof input.id === "string" ? input.id : "";
  if (!ID.test(id)) return { basket: null, error: "That basket id does not look right." };

  const stored = await ship.kv.get(`basket:${id}`);
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
    return { basket: null, error: "This basket no longer exists." };
  }
  const uid = ship.user && typeof ship.user.id === "string" ? ship.user.id : null;
  return { basket: { ...stored, auto: false, mine: uid !== null && stored.creatorId === uid } };
}
