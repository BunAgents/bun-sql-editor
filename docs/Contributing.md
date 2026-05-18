# Contributing

## Getting Started

```bash
git clone https://github.com/BunAgents/bun-sql-editor
cd bun-sql-editor
bun install
bun run dev   # → http://localhost:1983 with hot reload
```

## Project Structure

```
app/
  adapters/          # One file per database type (server-side)
  client/            # Frontend TypeScript — bundled → public/app.js
    main.ts          # Entry point: boot + event wiring
    core/            # Pure logic, no DOM (unit-testable)
    data/            # State, API calls, localStorage
    ui/              # DOM-coupled feature modules
  public/            # Served static files
    app.js           # Built bundle (do not edit directly)
    styles.css
    index.html
  server.ts          # Bun HTTP server + API routing
  types.ts           # Shared server-side types
tests/
  unit/core/         # 32 unit tests, no DB or browser required
  e2e/               # Playwright end-to-end tests
.github/
  workflows/
    release.yml      # Build + release pipeline
install.sh           # macOS/Linux one-line installer
install.ps1          # Windows PowerShell one-line installer
```

See [[Architecture]] for a full breakdown of the client module groups.

## Development Guidelines

- **Backend** — TypeScript, Bun runtime. Run `bun run build` to type-check.
- **Frontend** — TypeScript modules, compiled by `bun build`. Edit files in `app/client/`, then run `bun run build:client` to rebuild `app/public/app.js`.
- **Tests** — `bun test` runs 32 unit tests with no DB or browser. Pure logic lives in `app/client/core/` so it stays testable.
- **Database adapters** — each adapter exports `runX`, `testX`, `schemaX`, `columnsX`. Add `erdX` if the database supports FK relationships.

## Adding a New Database Adapter

1. Create `app/adapters/yourdb.ts` exporting `runYourdb`, `testYourdb`, `schemaYourdb`, `columnsYourdb`
2. Add the new type to `app/types.ts` (`DbType`)
3. Add routing cases in `app/server.ts` (`queryRouter`, `testRouter`, `schemaRouter`, `columnsRouter`)
4. Add connection form defaults to `app/client/ui/connections.ts` (search `DB_DEFAULTS`)

## Running Tests

```bash
bun test                 # unit tests (32 tests, ~8ms, no DB)
bun run test:e2e         # Playwright E2E (auto-starts app)
```

## Releasing

Push a tag matching `release-v*`:

```bash
git tag release-v1.2.0
git push origin release-v1.2.0
```

GitHub Actions builds binaries for macOS arm64, Windows x64, and Linux x64, then creates a GitHub Release. Users install via `install.sh` / `install.ps1`.

## Code Style

- TypeScript strict mode
- No external UI libraries on the frontend
- Prefer explicit error messages over generic ones
- All database queries should use parameterized statements where possible
