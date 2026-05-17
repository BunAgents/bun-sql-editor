# Features

## Schema Explorer

Left sidebar shows your database as a collapsible tree. Double-click any table/collection to open a pre-filled query tab. Right-click for context menu actions.

**Object types by database:**

| Type | PG | MySQL | MongoDB | ClickHouse |
|------|----|-------|---------|------------|
| Tables | ✓ | ✓ | — | ✓ |
| Views | ✓ | ✓ | ✓ | ✓ |
| Materialized Views | ✓ | — | — | ✓ |
| Collections | — | — | ✓ | — |
| Functions/Procedures | ✓ | ✓ | — | — |
| Sequences | ✓ | — | — | — |
| Triggers | ✓ | ✓ | — | — |
| Indexes | ✓ | — | — | — |

## Query Editor

- **Run** — `Ctrl+Enter`
- **Format SQL** — `Ctrl+Shift+F`
- **History** — `Ctrl+H`
- **New tab** — `Ctrl+T`
- **Close tab** — `Ctrl+W`

Multiple tabs, each independent. Results shown in scrollable table below editor.

## Inline Cell Editing

Double-click any result cell to edit. Generates a safe `UPDATE` statement using the primary key. Press Enter to apply, Escape to cancel.

> Requires the result set to include the primary key column — use `SELECT *`.

## SQL Formatter

`Ctrl+Shift+F` — token-based formatter that respects string literals, comments, and identifiers.

## Query History

`Ctrl+H` — opens history panel. All queries saved to localStorage. Click any entry to reload it.

## ERD Diagrams

Click the ERD icon on any schema, or right-click → Open ERD.

- Drag table cards to rearrange
- Scroll/pinch to zoom
- Drag background to pan
- FK relationships shown as bezier curves
- ClickHouse: tables only (no FK constraints)

## Autocomplete

Triggered automatically while typing. `Tab`/`Enter` to accept, `Escape` to dismiss.

- Schema names, table/view names, column names (via dot completion: `tablename.`)
- DB-specific keywords: SQL for PG/MySQL, ClickHouse functions/engines, MongoDB operators

Identifiers with uppercase letters are automatically quoted on insert.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Run query |
| `Ctrl+Shift+F` | Format SQL |
| `Ctrl+H` | Query history |
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Tab / Enter` | Accept autocomplete |
| `Escape` | Dismiss autocomplete |
| `↑ / ↓` | Navigate autocomplete |

## PostgreSQL Extras

- VACUUM ANALYZE (right-click table)
- REINDEX TABLE (right-click table)
- Full FK ERD with ON DELETE rules

## MongoDB Query Format

```json
{
  "collection": "users",
  "action": "find",
  "filter": { "active": true },
  "projection": { "name": 1, "email": 1 },
  "sort": { "created_at": -1 },
  "limit": 100
}
```

Actions: `find`, `findOne`, `aggregate`, `count`, `distinct`

Column inference: samples 20 documents to infer field names and types.

## ClickHouse

- Multi-database tree (excludes system/information_schema)
- Detects View and MaterializedView engine types
- Real nullable detection (`Nullable(...)` type prefix)
- Real primary key detection (`is_in_primary_key`)
- 80+ ClickHouse-specific autocomplete keywords
