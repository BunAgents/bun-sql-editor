# Bun DB Navigator (PWA)

A Navicat-like **PWA** query tool built with Bun that supports:
- PostgreSQL
- MySQL
- MongoDB
- ClickHouse

## Quick Start

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How Queries Work

- PostgreSQL/MySQL/ClickHouse: write SQL query text.
- MongoDB: write JSON command in this shape:

```json
{
  "collection": "users",
  "action": "find",
  "filter": {},
  "limit": 20
}
```

For aggregate:

```json
{
  "collection": "orders",
  "action": "aggregate",
  "pipeline": [
    { "$match": { "status": "paid" } },
    { "$group": { "_id": "$country", "count": { "$sum": 1 } } }
  ]
}
```

## Architecture

- `src/server.ts`: Bun HTTP server + API routes + static file serving
- `src/adapters/*.ts`: database adapters for each engine
- `src/public/*`: PWA frontend, service worker, manifest, styles

## Notes

- This is MVP foundation (query runner + saved profiles).
- Next features to match Navicat deeper: schema explorer, tabs, query history, visual explain plans, import/export, SSH tunnels, RBAC.
