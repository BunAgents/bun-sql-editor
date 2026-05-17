# Contributing

## Getting Started

```bash
git clone https://github.com/BunAgents/bun-sql-editor
cd bun-sql-editor
bun install
bun run dev   # → http://localhost:3000
```

## Project Structure

```
app/
  adapters/     # One file per database type
  public/       # Vanilla JS frontend (no framework, no bundler)
    app.js      # All frontend logic (~3000 lines)
    styles.css
    index.html
  server.ts     # Bun HTTP server
  types.ts      # Shared types
landing/        # Static landing page
docs/           # GitHub Wiki source
.github/
  workflows/
    release.yml # Build pipeline
```

## Development Guidelines

- **Backend** — TypeScript, Bun runtime. Run `bun run build` to type-check.
- **Frontend** — Vanilla JS ES modules. No framework, no bundler. Edit `app/public/app.js` directly.
- **No bundler step** — the server serves files from `app/public/` directly.
- **Database adapters** — each adapter exports `runX`, `testX`, `schemaX`, `columnsX` functions. Add `erdX` if the database supports FK relationships.

## Adding a New Database Adapter

1. Create `app/adapters/yourdb.ts` exporting `runYourdb`, `testYourdb`, `schemaYourdb`, `columnsYourdb`
2. Add the new type to `app/types.ts` (`DbType`)
3. Add routing cases in `app/server.ts` (`queryRouter`, `testRouter`, `schemaRouter`, `columnsRouter`)
4. Add the connection form defaults in `app/public/app.js` (search for `DB_DEFAULTS`)

## Releasing

Push a tag matching `release-v*`:

```bash
git tag release-v1.2.0
git push origin release-v1.2.0
```

GitHub Actions builds binaries for macOS arm64/x64, Windows x64, Linux x64 and creates a GitHub Release.

## Code Style

- TypeScript strict mode
- No external UI libraries on the frontend
- Prefer explicit error messages over generic ones
- All database queries should use parameterized statements where possible
