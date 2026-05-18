# Architecture

## Overview

```
Browser (localhost:1983) → Bun HTTP server → Your database
```

The binary runs a local HTTP server. The browser loads a single-page app (`app.js`) that communicates with the server via JSON API calls. Credentials go to `localhost` only — never to any external server.

---

## Client Source Layout

The frontend is written in TypeScript and compiled to a **single `app.js` bundle** by `bun build`. The source is organized into three groups under `app/client/`:

```
app/client/
  main.ts          ← entry point (boot + event wiring)
  core/            ← pure logic, no DOM, no network
  data/            ← state, API calls, localStorage
  ui/              ← DOM-coupled feature modules
```

### core/ — Pure Logic

No DOM, no `fetch`, no side effects. These files can be imported in any environment including unit tests running in Bun's bare runtime (no browser).

| File | Responsibility |
|------|---------------|
| `types.ts` | All client-side TypeScript types |
| `tokenizer.ts` | SQL tokenizer: keywords, strings, comments, numbers |
| `formatter.ts` | SQL formatter: token-based, respects string literals |
| `utils.ts` | `sortedRows` (sort result grid), `csvEscape` |
| `lock-core.ts` | `hashPin` (SHA-256 via Web Crypto), `hasPin` |

### data/ — State and I/O

No direct DOM manipulation. Manages application state and all external I/O (API calls, localStorage).

| File | Responsibility |
|------|---------------|
| `state.ts` | `AppState` type + singleton `S` + `activeConn()`/`activeTab()` |
| `api.ts` | `fetch` wrappers: `apiQuery`, `apiSchema`, `apiColumns`, `apiErd`, `apiTest` |
| `persistence.ts` | `save()` and `loadPersistedState()` — localStorage read/write |

### ui/ — Feature Modules

DOM-coupled. Each file owns one feature area. All use `el` from `dom.ts` for typed element access.

| File | Responsibility |
|------|---------------|
| `dom.ts` | Typed `getElementById` refs for every DOM element |
| `svg.ts` | SVG icon builder |
| `status.ts` | Status bar (idle / ok / error) |
| `theme.ts` | Dark/light theme toggle |
| `editor.ts` | Syntax highlight layer, line gutter, resize handle |
| `results.ts` | Result table render, inline cell editing, CSV/JSON export |
| `tabs.ts` | Tab create/close/switch, editor sync |
| `connections.ts` | Connection list, add/edit modal |
| `schema.ts` | Schema sidebar tree, lazy column loading |
| `query.ts` | `runQuery`, `runExplain`, `executeDdl` |
| `history.ts` | Query history panel |
| `ddl.ts` | Table editor, DDL/ALTER generation |
| `erd.ts` | ERD diagram: pan, zoom, drag, FK bezier lines |
| `autocomplete.ts` | Inline SQL/schema autocomplete dropdown |
| `contextmenu.ts` | Right-click context menu |
| `lock.ts` | Screen lock, PIN entry, PIN management modal |

---

## Why a Single Bundle?

Bun's bundler walks the TypeScript import graph from `main.ts` and emits one minified file. Benefits:

- **No extra HTTP round-trips** — one file, one request.
- **No runtime module loading** in production — everything inlined and tree-shaken.
- **3 ms build time** — Bun's bundler is written in Zig.

The three-folder split (`core/`, `data/`, `ui/`) is a **source convention**, not a runtime boundary. All modules collapse into `app.js` at build time.

---

## Server Architecture

`app/server.ts` is a Bun HTTP server that routes API requests:

| Endpoint | Handler |
|----------|---------|
| `POST /api/query` | Execute a query |
| `POST /api/schema` | Fetch schema tree |
| `POST /api/columns` | Fetch column metadata |
| `POST /api/erd` | Fetch FK relationships |
| `POST /api/test` | Test a connection |
| `GET /*` | Serve static files from `app/public/` |

Database adapters live in `app/adapters/`:
- `postgres.ts` — `pg` driver
- `mysql.ts` — `mysql2` driver
- `mongodb.ts` — `mongodb` driver
- `clickhouse.ts` — `@clickhouse/client` driver

---

## Testing

```
tests/
  unit/core/          ← import directly from app/client/core/
    tokenizer.test.ts
    formatter.test.ts
    utils.test.ts
    lock.test.ts
  e2e/
    app.spec.ts       ← Playwright, auto-boots the server
```

Unit tests run with `bun test` — no browser, no database, no network. They import from `core/` because those files have no DOM or `fetch` dependencies.

E2E tests use Playwright with `webServer` config that starts the app automatically before the suite runs.

```bash
bun test              # 32 unit tests, ~8ms
bun run test:e2e      # Playwright (needs bun run dev running, or CI auto-starts it)
```

---

## Data Flow

```
User action (click / keypress)
  → event listener in main.ts or ui/*.ts
  → reads state from data/state.ts (S)
  → calls data/api.ts → fetch → server → database
  → updates S with response
  → calls ui/*.ts render functions to update DOM
  → calls data/persistence.ts to save to localStorage
```

State (`S`) is a single mutable object imported by all modules. There is no reactive framework — DOM updates are imperative, triggered explicitly after data changes.
