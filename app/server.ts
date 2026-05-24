import pkg from "../package.json";
import { dirname, join } from "node:path";

const PORT = Number(process.env.PORT ?? 1983);

if (Bun.argv.includes("--version") || Bun.argv.includes("-v")) {
  console.log(`release-v${pkg.version}`);
  process.exit(0);
}

// ── CLI: --stop / --restart ───────────────────────────────────────────────────
async function sendServerCommand(cmd: "stop" | "restart"): Promise<void> {
  try {
    const res = await fetch(`http://localhost:${PORT}/api/server/${cmd}`, { method: "POST" });
    if (res.ok) {
      console.log(cmd === "stop" ? "Server stopped." : "Server restarting…");
    } else {
      console.error(`Server returned ${res.status}`);
      process.exit(1);
    }
  } catch {
    console.error(`Could not reach server on port ${PORT}. Is it running?`);
    process.exit(1);
  }
}

if (Bun.argv.includes("--stop")) {
  await sendServerCommand("stop");
  process.exit(0);
}
if (Bun.argv.includes("--restart")) {
  await sendServerCommand("restart");
  process.exit(0);
}
if (Bun.argv.includes("--upgrade") || Bun.argv.includes("--update")) {
  const iW = !!process.stdout.isTTY;
  const W = (s: string) => process.stdout.write(s);
  if (iW) W("\x1b[36m⠋\x1b[0m Fetching latest release…\r");
  const rel = await fetch("https://api.github.com/repos/BunAgents/bun-sql-editor/releases/latest")
    .then(r => r.json() as Promise<{ tag_name: string; assets: { browser_download_url: string; name: string }[] }>)
    .catch(() => null);
  if (!rel) { console.error("Could not reach GitHub API"); process.exit(1); }
  const current = `release-v${pkg.version}`;
  if (rel.tag_name === current) {
    if (iW) W(`\x1b[32m✓\x1b[0m Already up to date: ${current}\n`);
    else console.log(`Already up to date: ${current}`);
    process.exit(0);
  }
  const os = process.platform === "darwin" ? "macos" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const artifact = `bun-sql-editor-${os}-${arch}`;
  const asset = rel.assets.find(a => a.name === artifact + ".tar.gz") ?? rel.assets.find(a => a.name === artifact);
  if (!asset) { console.error(`No release artifact for ${artifact}`); process.exit(1); }
  if (iW) W(`\x1b[36m⠹\x1b[0m Downloading ${rel.tag_name}…\r`);
  const buf = await fetch(asset.browser_download_url).then(r => r.arrayBuffer());
  const tmp = `/tmp/bsql-upgrade-${Date.now()}`;
  await Bun.write(tmp, buf);
  const installDir = process.execPath.replace(/\/bun-sql-editor$/, "");
  if (asset.name.endsWith(".tar.gz")) {
    Bun.spawnSync(["tar", "-xzf", tmp, "-C", installDir]);
  } else {
    Bun.spawnSync(["cp", tmp, process.execPath]);
    Bun.spawnSync(["chmod", "+x", process.execPath]);
  }
  if (iW) W(`\x1b[32m✓\x1b[0m Upgraded ${current} → ${rel.tag_name}\n`);
  else console.log(`Upgraded ${current} → ${rel.tag_name}`);
  process.exit(0);
}

// When compiled to a standalone binary, static files live next to the exe.
// In dev (bun run app/server.ts), they live at ./app/public relative to CWD.
const IS_COMPILED = process.execPath.includes("bun-sql-editor");
const PUBLIC_DIR = IS_COMPILED
  ? join(dirname(process.execPath), "public")
  : join(process.cwd(), "app/public");

import { runPostgres, schemaPostgres, testPostgres, columnsPostgres, erdPostgres } from "./adapters/postgres";
import { runMysql, schemaMysql, testMysql, columnsMysql, erdMysql } from "./adapters/mysql";
import { runMongo, schemaMongo, testMongo, columnsMongo } from "./adapters/mongodb";
import { runClickhouse, schemaClickhouse, testClickhouse, columnsClickhouse, erdClickhouse } from "./adapters/clickhouse";
import type { QueryRequest, SchemaRequest, TestRequest, ColumnsRequest, ErdRequest } from "./types";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
} as const;

function contentType(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")) as keyof typeof MIME;
  return MIME[ext] ?? "text/plain; charset=utf-8";
}

async function queryRouter(body: QueryRequest) {
  switch (body.type) {
    case "postgres":
      return runPostgres(body.connection, body.query);
    case "mysql":
      return runMysql(body.connection, body.query);
    case "mongodb":
      return runMongo(body.connection, body.query);
    case "clickhouse":
      return runClickhouse(body.connection, body.query);
    default:
      throw new Error("Unsupported database type");
  }
}

async function testRouter(body: TestRequest) {
  switch (body.type) {
    case "postgres":
      return testPostgres(body.connection);
    case "mysql":
      return testMysql(body.connection);
    case "mongodb":
      return testMongo(body.connection);
    case "clickhouse":
      return testClickhouse(body.connection);
    default:
      throw new Error("Unsupported database type");
  }
}

async function schemaRouter(body: SchemaRequest) {
  switch (body.type) {
    case "postgres":
      return schemaPostgres(body.connection);
    case "mysql":
      return schemaMysql(body.connection);
    case "mongodb":
      return schemaMongo(body.connection);
    case "clickhouse":
      return schemaClickhouse(body.connection);
    default:
      throw new Error("Unsupported database type");
  }
}

async function columnsRouter(body: ColumnsRequest) {
  switch (body.type) {
    case "postgres":
      return columnsPostgres(body.connection, body.schema, body.table);
    case "mysql":
      return columnsMysql(body.connection, body.schema, body.table);
    case "clickhouse":
      return columnsClickhouse(body.connection, body.schema, body.table);
    case "mongodb":
      return columnsMongo(body.connection, body.schema, body.table);
    default:
      throw new Error("Unsupported database type");
  }
}

async function erdRouter(body: ErdRequest) {
  switch (body.type) {
    case "postgres":
      return erdPostgres(body.connection, body.schema);
    case "mysql":
      return erdMysql(body.connection, body.schema);
    case "clickhouse":
      return erdClickhouse(body.connection, body.schema);
    case "mongodb":
      return { tables: [], relations: [], elapsedMs: 0 }; // MongoDB has no FK constraints
    default:
      throw new Error("Unsupported database type");
  }
}

// ── Startup display ───────────────────────────────────────────────────────────
const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
const isTTY = !!process.stdout.isTTY;

// Each row: 1 = filled block, 0 = space. Letters: B U N  S Q L
// 5-row tall pixel font, each char is 4 cols wide + 1 gap
const LOGO_PIXELS: number[][] = [
  // B          U          N          gap  S          Q          L
  [1,1,1,0, 0, 1,0,0,1, 0, 1,0,0,1, 0,0, 1,1,1,0, 0, 0,1,1,0, 0, 1,0,0,0],
  [1,0,0,1, 0, 1,0,0,1, 0, 1,1,0,1, 0,0, 1,0,0,0, 0, 1,0,0,1, 0, 1,0,0,0],
  [1,1,1,0, 0, 1,0,0,1, 0, 1,0,1,1, 0,0, 0,1,1,0, 0, 1,0,0,1, 0, 1,0,0,0],
  [1,0,0,1, 0, 1,0,0,1, 0, 1,0,0,1, 0,0, 0,0,0,1, 0, 1,0,1,1, 0, 1,0,0,0],
  [1,1,1,0, 0, 0,1,1,0, 0, 1,0,0,1, 0,0, 1,1,1,0, 0, 0,1,1,1, 0, 1,1,1,1],
];

// Gradient left→right: cyan #45c8f5 → violet #9b59f5 → pink #f575c8
function gradColor(col: number, total: number): string {
  const t = col / Math.max(total - 1, 1);
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const u = t * 2;
    r = Math.round(69  + u * (155 - 69));
    g = Math.round(200 + u * (89  - 200));
    b = 245;
  } else {
    const u = (t - 0.5) * 2;
    r = Math.round(155 + u * (245 - 155));
    g = Math.round(89  + u * (117 - 89));
    b = Math.round(245 + u * (200 - 245));
  }
  return `\x1b[38;2;${r};${g};${b}m`;
}

function printLogo(): void {
  if (!isTTY) return;
  const totalCols = LOGO_PIXELS[0].length;
  process.stdout.write("\n");
  for (const row of LOGO_PIXELS) {
    let line = "  ";
    for (let c = 0; c < row.length; c++) {
      line += row[c] ? gradColor(c, totalCols) + "██" : "  ";
    }
    process.stdout.write(line + "\x1b[0m\n");
  }
  process.stdout.write("\n");
}

function spin(label: string): { stop: (ok: boolean, done: string) => void } {
  if (!isTTY) { return { stop: (_ok, done) => process.stdout.write(`  ${done}\n`) }; }
  let i = 0;
  const t = setInterval(() => {
    process.stdout.write(`\r  \x1b[36m${FRAMES[i++ % FRAMES.length]}\x1b[0m ${label}…`);
  }, 80);
  return {
    stop(ok: boolean, done: string) {
      clearInterval(t);
      const icon = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[33m✗\x1b[0m";
      process.stdout.write(`\r  ${icon} ${done}\x1b[0m\n`);
    },
  };
}

printLogo();

const BUILD_TIME = Date.now().toString(36);

const s1 = spin("Starting server");
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/query" && req.method === "POST") {
      try {
        const body = (await req.json()) as QueryRequest;
        const result = await queryRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/test" && req.method === "POST") {
      try {
        const body = (await req.json()) as TestRequest;
        const result = await testRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { ok: false, message: error instanceof Error ? error.message : "Unknown error", elapsedMs: 0 },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/schema" && req.method === "POST") {
      try {
        const body = (await req.json()) as SchemaRequest;
        const result = await schemaRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/columns" && req.method === "POST") {
      try {
        const body = (await req.json()) as ColumnsRequest;
        const result = await columnsRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/erd" && req.method === "POST") {
      try {
        const body = (await req.json()) as ErdRequest;
        const result = await erdRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/server/stop" && req.method === "POST") {
      setTimeout(() => process.exit(0), 50);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/server/restart" && req.method === "POST") {
      setTimeout(() => {
        Bun.spawn([process.execPath, ...process.argv.slice(1)], {
          stdio: ["inherit", "inherit", "inherit"],
          detached: true,
        });
        process.exit(0);
      }, 50);
      return Response.json({ ok: true });
    }

    // Serve static files from PUBLIC_DIR (next to binary when compiled, ./app/public in dev)
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname.split("?")[0];
    const file = Bun.file(join(PUBLIC_DIR, pathname));

    if (await file.exists()) {
      if (pathname === "/index.html") {
        let html = await file.text();
        html = html.replace('src="/app.js"', `src="/app.js?v=${BUILD_TIME}"`);
        html = html.replace('href="/styles.css"', `href="/styles.css?v=${BUILD_TIME}"`);
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
        });
      }
      const noStore = pathname.endsWith(".js") || pathname.endsWith(".css");
      return new Response(file, {
        headers: {
          "content-type": contentType(pathname),
          "cache-control": noStore ? "no-store" : "no-cache",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

// Landing page server (dev only — in production landing is deployed separately)
const landingPort = Number(process.env.LANDING_PORT ?? 4000);
Bun.serve({
  port: landingPort,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;
    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const file = Bun.file(`./landing${pathname}`);
    if (await file.exists()) {
      const noStore = pathname.endsWith(".js") || pathname.endsWith(".css");
      return new Response(file, {
        headers: {
          "content-type": contentType(pathname),
          "cache-control": noStore ? "no-store" : "no-cache",
        },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

const D = "\x1b[2m", R = "\x1b[0m", CY = "\x1b[36m", B = "\x1b[1m";
s1.stop(true, `Server running  ${D}http://localhost:${server.port}${R}`);

// Open browser
const appUrl = `http://localhost:${server.port}`;
if (IS_COMPILED) {
  const s2 = spin("Opening browser");
  if (process.platform === "darwin") Bun.spawn(["open", appUrl]);
  else if (process.platform === "linux") Bun.spawn(["xdg-open", appUrl]);
  else if (process.platform === "win32") Bun.spawn(["cmd", "/c", "start", appUrl]);
  s2.stop(true, `Browser opened  ${D}${appUrl}${R}`);
}

if (isTTY) {
  // Tips section
  process.stdout.write(`\n${D}  Tips for getting started:${R}\n`);
  process.stdout.write(`${D}  1. Connect to PostgreSQL, MySQL, MongoDB, or ClickHouse.${R}\n`);
  process.stdout.write(`${D}  2. Use ${R}${CY}Ctrl+Enter${R}${D} to run queries, ${R}${CY}F5${R}${D} to refresh schema.${R}\n`);
  process.stdout.write(`${D}  3. Enable AI assistant in Settings for natural-language SQL.${R}\n`);

  // Status bar (bottom line, dim)
  const cols = process.stdout.columns ?? 80;
  const left  = `  http://localhost:${server.port}`;
  const mid   = `v${pkg.version}`;
  const right = `--stop  --restart  --version  `;
  const gap1  = Math.max(1, Math.floor((cols - left.length - mid.length - right.length) / 2));
  const gap2  = cols - left.length - mid.length - right.length - gap1;
  process.stdout.write(`\n${D}${left}${" ".repeat(Math.max(gap1, 1))}${B}${mid}${R}${D}${" ".repeat(Math.max(gap2, 1))}${right}${R}\n\n`);
} else {
  process.stdout.write(`SQL editor running on ${appUrl}\n`);
}
