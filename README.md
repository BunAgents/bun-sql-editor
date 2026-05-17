# Bun SQL Editor

> A lightweight, open-source SQL workbench that runs as a single local binary.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black?logo=bun)](https://bun.sh)
[![GitHub Releases](https://img.shields.io/github/v/release/BunAgents/bun-sql-editor?label=latest)](https://github.com/BunAgents/bun-sql-editor/releases)
[![GitHub Issues](https://img.shields.io/github/issues/BunAgents/bun-sql-editor)](https://github.com/BunAgents/bun-sql-editor/issues)

Connect to **PostgreSQL**, **MySQL**, **MongoDB**, and **ClickHouse** from a single interface. No cloud. No signup. Your credentials never leave your machine.

---

## Features

- **Multi-database** — PostgreSQL, MySQL, MongoDB, ClickHouse in one tool
- **Schema Explorer** — tables, views, materialized views, functions, sequences, triggers, indexes
- **ERD Diagrams** — visualize FK relationships per schema; drag cards, zoom, pan
- **Smart Autocomplete** — schema/table/column hints, DB-specific keywords (ClickHouse functions, MongoDB operators)
- **Inline Cell Editing** — double-click any result cell to generate a safe `UPDATE` statement
- **SQL Formatter** — `Ctrl+Shift+F`, token-based parser that respects string literals
- **Query History** — `Ctrl+H`, all queries saved to localStorage
- **Maintenance Tools** — VACUUM ANALYZE, REINDEX TABLE from right-click menu (PostgreSQL)
- **PWA Installable** — install to desktop, service worker caches the UI shell
- **Single binary** — no runtime, no Docker, no installation required

---

## Install

**macOS / Linux — one line:**

```bash
curl -fsSL https://raw.githubusercontent.com/BunAgents/bun-sql-editor/main/install.sh | bash
```

The script detects your platform, downloads the right binary, removes the macOS quarantine flag automatically, and installs to `/usr/local/bin`. Then just run:

```bash
bun-sql-editor
```

Open **http://localhost:3000** in your browser.

**Custom port:**

```bash
PORT=8080 bun-sql-editor
```

**Windows — PowerShell:**

```powershell
irm https://raw.githubusercontent.com/BunAgents/bun-sql-editor/main/install.ps1 | iex
```

Installs to `%LOCALAPPDATA%\bun-sql-editor` and adds it to your user `PATH`. Runs `Unblock-File` to clear the SmartScreen flag automatically.

**Manual download** — [**Releases**](https://github.com/BunAgents/bun-sql-editor/releases):

| Platform | File |
|----------|------|
| macOS Apple Silicon | `bun-sql-editor-macos-arm64` |
| macOS Intel | `bun-sql-editor-macos-x64` |
| Windows x64 | `bun-sql-editor-windows-x64.exe` |
| Linux x64 | `bun-sql-editor-linux-x64` |

---

## How It Works

```
Browser (localhost:3000) → Local binary → Your database
```

The binary starts a small HTTP server on your machine. Your browser connects to `localhost`. The binary acts as a proxy between browser and database. Credentials go to `localhost` only — never to any external server.

Connection configs and query history are stored in your **browser's localStorage**. The binary is stateless: it stores nothing on disk.

---

## Database Connection Defaults

| Database | Host | Port | User | DB |
|----------|------|------|------|----|
| PostgreSQL | localhost | 5432 | postgres | postgres |
| MySQL | localhost | 3306 | root | mysql |
| MongoDB | mongodb://localhost:27017 | — | — | (set DB name) |
| ClickHouse | http://localhost:8123 | — | default | default |

---

## MongoDB Query Format

MongoDB uses JSON instead of SQL:

```json
{
  "collection": "users",
  "action": "find",
  "filter": { "active": true },
  "limit": 50
}
```

Supported actions: `find`, `findOne`, `aggregate`, `count`, `distinct`

---

## Build from Source

Requires [Bun](https://bun.sh):

```bash
git clone https://github.com/BunAgents/bun-sql-editor
cd bun-sql-editor
bun install
bun run dev              # development with hot reload → http://localhost:3000
bun run build:client     # bundle TypeScript client → app/public/app.js
bun run build            # type check + bundle
bun test                 # run unit tests (32 tests, no DB required)
bun run test:e2e         # run Playwright E2E tests (needs app running)
```

Compile a self-contained binary:

```bash
# macOS ARM
bun build --compile --target=bun-darwin-arm64 app/server.ts --outfile=bun-sql-editor

# macOS Intel
bun build --compile --target=bun-darwin-x64 app/server.ts --outfile=bun-sql-editor

# Linux x64
bun build --compile --target=bun-linux-x64 app/server.ts --outfile=bun-sql-editor

# Windows x64
bun build --compile --target=bun-windows-x64 app/server.ts --outfile=bun-sql-editor.exe
```

---

## Project Structure

The client source is split into three groups under `app/client/`. All groups compile to a **single `app.js` bundle** via `bun build` — no runtime module loading, no extra HTTP requests. The grouping is purely for source organization.

```
app/
  adapters/              # Database-specific query runners (server-side)
    postgres.ts
    mysql.ts
    mongodb.ts
    clickhouse.ts
  client/                # Frontend TypeScript — bundled → public/app.js
    main.ts              # Entry point: boot sequence + event wiring
    core/                # Pure logic — no DOM, no network (unit-testable)
      types.ts           # All client-side type definitions
      tokenizer.ts       # SQL tokenizer (keywords, strings, comments)
      formatter.ts       # SQL formatter
      utils.ts           # sortedRows, csvEscape
      lock-core.ts       # hashPin / hasPin (SHA-256 via Web Crypto)
    data/                # State, API, persistence — no direct DOM
      state.ts           # AppState singleton (S) + activeConn/activeTab helpers
      api.ts             # fetch wrappers: apiQuery, apiSchema, apiColumns, apiErd
      persistence.ts     # localStorage save/load
    ui/                  # DOM-coupled feature modules
      dom.ts             # Typed getElementById refs for every DOM element
      svg.ts             # SVG icon builder
      status.ts          # Status bar
      theme.ts           # Dark/light theme toggle
      editor.ts          # Syntax highlight layer + gutter + resize handle
      results.ts         # Result table render + inline cell editing + CSV/JSON export
      tabs.ts            # Tab lifecycle: create, close, switch, sync
      connections.ts     # Connection list + add/edit modal
      schema.ts          # Schema sidebar tree + lazy column loading
      query.ts           # runQuery, runExplain, executeDdl
      history.ts         # Query history panel
      ddl.ts             # Table editor + DDL/ALTER generation
      erd.ts             # ERD diagram: pan, zoom, drag, FK lines
      autocomplete.ts    # Inline SQL/schema autocomplete dropdown
      contextmenu.ts     # Right-click context menu
      lock.ts            # Screen lock + PIN management
  public/                # Served static files
    app.js               # Built bundle (output of bun run build:client)
    index.html
    styles.css
  server.ts              # Bun HTTP server + API routing
  types.ts               # Shared server-side types
tests/
  unit/                  # Bun unit tests — no DOM, no DB, no network
    core/
      tokenizer.test.ts  # SQL tokenizer: 9 tests
      formatter.test.ts  # SQL formatter: 8 tests
      utils.test.ts      # csvEscape + sortedRows: 11 tests
      lock.test.ts       # PIN hashing (SHA-256): 4 tests
  e2e/                   # Playwright end-to-end tests
    app.spec.ts          # UI flows: tabs, theme, connections, editor, lock
landing/                 # Static landing page (wiki, blog)
docs/                    # GitHub Wiki source
playwright.config.ts
```

### Why a single `app.js`?

Bun's bundler traverses the TypeScript import graph from `main.ts` and emits one minified file. This means:

- **Zero extra HTTP round-trips** — the browser fetches one file, executes one file.
- **No dynamic module loading** in production — everything is inlined.
- **Full tree-shaking** — dead code from any module is eliminated.
- **3 ms build time** — Bun's native bundler is written in Zig, not JavaScript.

The three-folder split (`core/`, `data/`, `ui/`) is a source convention, not a runtime boundary. Unit tests import directly from `core/` because those files carry zero DOM or network dependencies.

---

## Releasing

Push a tag to trigger the release pipeline:

```bash
git tag release-v1.0.0
git push origin release-v1.0.0
```

GitHub Actions builds binaries for all 4 platforms and creates a GitHub Release with auto-generated release notes.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run query |
| `Ctrl+Shift+F` | Format SQL |
| `Ctrl+H` | Toggle query history |
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Tab / Enter` | Accept autocomplete |
| `Escape` | Dismiss autocomplete |

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes and run `bun run build` to type-check
4. Open a pull request

See [docs/Contributing.md](docs/Contributing.md) for full guidelines.

---

## Why Not a Desktop App?

Code signing certificates cost $300–500/year per platform. Instead, Bun SQL Editor distributes as an open-source binary — you can read every line of source code and build it yourself. The one-time OS security prompt is a fair trade for full transparency.

---

## License

MIT © [BunAgents](https://github.com/BunAgents)
