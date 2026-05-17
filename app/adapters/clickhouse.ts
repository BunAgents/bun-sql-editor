import { createClient } from "@clickhouse/client";
import type { QueryResult, SchemaResult, TestResult, ColumnsResult } from "../types";

function makeClient(connection: Record<string, unknown>) {
  return createClient({
    host: String(connection.host ?? "http://localhost:8123"),
    username: String(connection.user ?? "default"),
    password: String(connection.password ?? ""),
    database: String(connection.database ?? "default"),
  });
}

export async function runClickhouse(
  connection: Record<string, unknown>,
  query: string,
): Promise<QueryResult> {
  const started = performance.now();
  const client = makeClient(connection);

  try {
    const resultSet = await client.query({
      query,
      format: "JSONEachRow",
      clickhouse_settings: { max_execution_time: 30 },
    });

    const rows = (await resultSet.json()) as Array<Record<string, unknown>>;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      columns,
      rows,
      rowCount: rows.length,
      elapsedMs: performance.now() - started,
    };
  } finally {
    await client.close();
  }
}

export async function testClickhouse(
  connection: Record<string, unknown>,
): Promise<TestResult> {
  const started = performance.now();
  const client = makeClient(connection);
  try {
    const result = await client.query({ query: "SELECT version()", format: "JSONEachRow" });
    const rows = (await result.json()) as Array<{ "version()": string }>;
    const ver = rows[0]?.["version()"] ?? "Connected";
    await client.close();
    return { ok: true, message: `ClickHouse ${ver}`, elapsedMs: performance.now() - started };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed", elapsedMs: performance.now() - started };
  }
}

export async function schemaClickhouse(
  connection: Record<string, unknown>,
): Promise<SchemaResult> {
  const started = performance.now();
  const client = makeClient(connection);

  try {
    const result = await client.query({
      query: `
        SELECT database, name
        FROM system.tables
        WHERE is_temporary = 0
        ORDER BY database, name
      `,
      format: "JSONEachRow",
    });

    const rows = (await result.json()) as Array<{ database: string; name: string }>;
    const items: SchemaResult["items"] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      if (!seen.has(row.database)) {
        items.push({ name: row.database, type: "schema" });
        seen.add(row.database);
      }
      items.push({ name: row.name, type: "table", parent: row.database });
    }

    return { items, elapsedMs: performance.now() - started };
  } finally {
    await client.close();
  }
}

export async function columnsClickhouse(
  connection: Record<string, unknown>,
  schema: string | undefined,
  table: string,
): Promise<ColumnsResult> {
  const started = performance.now();
  const client = makeClient(connection);
  try {
    const result = await client.query({
      query: `
        SELECT name, type AS data_type, 1 AS nullable, 0 AS is_primary
        FROM system.columns
        WHERE database = {db:String}
          AND table   = {tbl:String}
        ORDER BY position
      `,
      query_params: { db: schema ?? String(connection.database ?? "default"), tbl: table },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<{ name: string; data_type: string; nullable: number; is_primary: number }>;
    return {
      columns: rows.map(r => ({ name: r.name, dataType: r.data_type, nullable: Boolean(r.nullable), isPrimary: Boolean(r.is_primary) })),
      elapsedMs: performance.now() - started,
    };
  } finally {
    await client.close();
  }
}
