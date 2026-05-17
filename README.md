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

## Download

Grab the latest binary from [**Releases**](https://github.com/BunAgents/bun-sql-editor/releases):

| Platform | File |
|----------|------|
| macOS Apple Silicon | `bun-sql-editor-macos-arm64` |
| macOS Intel | `bun-sql-editor-macos-x64` |
| Windows x64 | `bun-sql-editor-windows-x64.exe` |
| Linux x64 | `bun-sql-editor-linux-x64` |

---

## Quick Start

```bash
# macOS / Linux
chmod +x bun-sql-editor-macos-arm64
./bun-sql-editor-macos-arm64

# Windows
bun-sql-editor-windows-x64.exe

# Custom port (default: 3000)
PORT=8080 ./bun-sql-editor-macos-arm64
```

Open **http://localhost:3000** in your browser.

> **macOS security warning:** Right-click → Open → Open. Or: `xattr -d com.apple.quarantine bun-sql-editor-macos-arm64`
>
> **Windows SmartScreen:** Click "More info" → "Run anyway"

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
bun run dev          # development with hot reload → http://localhost:3000
bun run build        # type check
```

Compile a self-contained binary:

```bash
# macOS ARM
bun build --compile --target=bun-darwin-arm64 app/server.ts --outfile=bun-sql-editor

# Linux
bun build --compile --target=bun-linux-x64 app/server.ts --outfile=bun-sql-editor

# Windows
bun build --compile --target=bun-windows-x64 app/server.ts --outfile=bun-sql-editor.exe
```

---

## Project Structure

```
app/
  adapters/         # Database-specific query runners
    postgres.ts
    mysql.ts
    mongodb.ts
    clickhouse.ts
  public/           # Frontend (vanilla JS, no framework, no bundler)
    app.js
    index.html
    styles.css
  server.ts         # Bun HTTP server + API routing
  types.ts          # Shared TypeScript types
landing/            # Static landing page (wiki, blog)
  wiki/
  blog/
docs/               # GitHub Wiki source
.github/workflows/
  release.yml       # Build binaries on release-v* tags
```

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
