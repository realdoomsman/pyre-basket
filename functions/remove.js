/**
 * Deletes one of the caller's own baskets and drops it from the public catalog.
 *
 * @param {unknown} input
 * @param {{ kv: { get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<void>, del(k: string): Promise<void> }, user: { id: string|null } }} ship
 */

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function uidKey(id) {
  return id.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 60);
}

export default async function handler(input, ship) {
  const uid = ship.user && typeof ship.user.id === "string" ? ship.user.id : null;
  if (uid === null) return { ok: false, reason: "auth", error: "Sign in to manage your baskets." };

  const id = input && typeof input === "object" && typeof input.id === "string" ? input.id : "";
  if (!ID.test(id)) return { ok: false, reason: "invalid", error: "That basket id does not look right." };

  const key = uidKey(uid);
  const storedIds = await ship.kv.get(`u:${key}:ids`);
  const ids = (Array.isArray(storedIds) ? storedIds : []).filter((v) => typeof v === "string");
  if (ids.indexOf(id) === -1) return { ok: false, reason: "owner", error: "That basket is not yours." };

  await ship.kv.del(`basket:${id}`);
  await ship.kv.set(
    `u:${key}:ids`,
    ids.filter((v) => v !== id),
  );

  const storedCatalog = await ship.kv.get("catalog");
  const catalog = (Array.isArray(storedCatalog) ? storedCatalog : []).filter((entry) => entry !== null && typeof entry === "object" && entry.id !== id);
  await ship.kv.set("catalog", catalog);

  return { ok: true, id };
}
