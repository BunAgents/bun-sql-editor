import { describe, it, expect, mock, beforeEach } from "bun:test";

// Test apiServerStop and apiServerRestart by mocking fetch.
// These are thin wrappers — we verify they call the right endpoint.

const calls: { url: string; method: string }[] = [];

beforeEach(() => {
  calls.length = 0;
  globalThis.fetch = mock(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as unknown as typeof fetch;
});

describe("apiServerStop", () => {
  it("POSTs to /api/server/stop", async () => {
    const { apiServerStop } = await import("../../../app/client/data/api");
    await apiServerStop();
    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain("/api/server/stop");
    expect(calls[0].method).toBe("POST");
  });

  it("does not throw if server is unreachable", async () => {
    globalThis.fetch = mock(async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const { apiServerStop } = await import("../../../app/client/data/api");
    await expect(apiServerStop()).resolves.toBeUndefined();
  });
});

describe("apiServerRestart", () => {
  it("POSTs to /api/server/restart", async () => {
    const { apiServerRestart } = await import("../../../app/client/data/api");
    await apiServerRestart();
    expect(calls.length).toBe(1);
    expect(calls[0].url).toContain("/api/server/restart");
    expect(calls[0].method).toBe("POST");
  });

  it("does not throw if server is unreachable", async () => {
    globalThis.fetch = mock(async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const { apiServerRestart } = await import("../../../app/client/data/api");
    await expect(apiServerRestart()).resolves.toBeUndefined();
  });
});
