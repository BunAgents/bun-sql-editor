export const LOCK_PIN_KEY = "bsql_lock_pin_hash";
export const LOCK_STATE_KEY = "bsql_locked";

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function hasPin(): boolean {
  return !!localStorage.getItem(LOCK_PIN_KEY);
}
