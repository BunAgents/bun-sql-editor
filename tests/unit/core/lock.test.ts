import { describe, it, expect } from "bun:test";
import { hashPin } from "../../../app/client/core/lock-core";

describe("hashPin", () => {
  it("returns a 64-char hex string (SHA-256)", async () => {
    const hash = await hashPin("1234");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("is deterministic for the same input", async () => {
    const h1 = await hashPin("secret");
    const h2 = await hashPin("secret");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different PINs", async () => {
    const h1 = await hashPin("1234");
    const h2 = await hashPin("5678");
    expect(h1).not.toBe(h2);
  });

  it("handles unicode input", async () => {
    const hash = await hashPin("🔑abc");
    expect(hash).toHaveLength(64);
  });
});
