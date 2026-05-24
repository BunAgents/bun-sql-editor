import { describe, it, expect, beforeAll, afterAll } from "bun:test";

// Integration tests for the server control API endpoints.
// Spins up a real server instance on a test port and hits /api/server/*.

const TEST_PORT = 19830;
const BASE = `http://localhost:${TEST_PORT}`;

let serverProc: ReturnType<typeof Bun.spawn>;

beforeAll(async () => {
  serverProc = Bun.spawn(["bun", "run", "app/server.ts"], {
    env: { ...process.env, PORT: String(TEST_PORT), LANDING_PORT: "40001" },
    stdout: "ignore",
    stderr: "ignore",
  });
  // Wait until server is ready
  for (let i = 0; i < 20; i++) {
    await Bun.sleep(200);
    try {
      const r = await fetch(BASE + "/");
      if (r.ok) break;
    } catch { /* still starting */ }
  }
});

afterAll(() => {
  serverProc?.kill();
});

describe("GET /", () => {
  it("serves index.html with 200", async () => {
    const res = await fetch(BASE + "/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});

describe("Static assets", () => {
  it("serves styles.css", async () => {
    const res = await fetch(BASE + "/styles.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });

  it("serves app.js", async () => {
    const res = await fetch(BASE + "/app.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
  });

  it("returns 404 for unknown paths", async () => {
    const res = await fetch(BASE + "/does-not-exist.xyz");
    expect(res.status).toBe(404);
  });

  it("injects cache-busting query string into index.html", async () => {
    const html = await fetch(BASE + "/").then(r => r.text());
    expect(html).toMatch(/app\.js\?v=/);
    expect(html).toMatch(/styles\.css\?v=/);
  });
});

describe("POST /api/server/stop", () => {
  it("returns { ok: true } before stopping", async () => {
    // We use a separate short-lived server for this test to avoid killing the main one
    const port = 19831;
    const p = Bun.spawn(["bun", "run", "app/server.ts"], {
      env: { ...process.env, PORT: String(port), LANDING_PORT: "40002" },
      stdout: "ignore", stderr: "ignore",
    });
    // Wait for it
    for (let i = 0; i < 20; i++) {
      await Bun.sleep(200);
      try { await fetch(`http://localhost:${port}/`); break; } catch { /* starting */ }
    }
    const res = await fetch(`http://localhost:${port}/api/server/stop`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    p.kill();
  });
});

describe("POST /api/server/restart", () => {
  it("returns { ok: true }", async () => {
    const res = await fetch(BASE + "/api/server/restart", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    // Wait for restart
    await Bun.sleep(1500);
    // Server should be back up
    for (let i = 0; i < 20; i++) {
      await Bun.sleep(200);
      try {
        const r = await fetch(BASE + "/");
        if (r.ok) return; // success
      } catch { /* restarting */ }
    }
    throw new Error("Server did not come back up after restart");
  });
});

describe("API error handling", () => {
  it("POST /api/query with bad JSON returns 400", async () => {
    const res = await fetch(BASE + "/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "postgres", connection: {}, query: "SELECT 1" }),
    });
    // Will error (no real DB) but must return 400 JSON, not 500 crash
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("POST /api/test with unknown type returns 400", async () => {
    const res = await fetch(BASE + "/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "unknown_db", connection: {} }),
    });
    expect(res.status).toBe(400);
  });
});
