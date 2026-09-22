/**
 * Records the Basket Pro entitlement after the platform has run checkout.
 *
 * The $8 charge itself is made by the platform (`charge("basket-pro")` in the browser,
 * settled in USDG from the user's custodial wallet) — an app must never build a payment
 * flow. This function only persists the resulting entitlement so the server-side basket
 * limit and the LLM assistant can honour it on later calls.
 *
 * @param {unknown} input
 * @param {{ kv: { get(k: string): Promise<unknown>, set(k: string, v: unknown): Promise<void> }, user: { id: string|null } }} ship
 */

function uidKey(id) {
  return id.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 60);
}

export default async function handler(input, ship) {
  const uid = ship.user && typeof ship.user.id === "string" ? ship.user.id : null;
  if (uid === null) return { ok: false, reason: "auth", error: "Log in first." };

  const key = uidKey(uid);
  const existing = await ship.kv.get(`ent:${key}`);
  if (existing !== null && typeof existing === "object") return { ok: true, entitlement: existing };

  const txHash =
    input && typeof input === "object" && typeof input.txHash === "string" ? input.txHash.slice(0, 80) : null;
  const entitlement = { product: "basket-pro", txHash, since: new Date().toISOString() };
  await ship.kv.set(`ent:${key}`, entitlement);
  return { ok: true, entitlement };
}
