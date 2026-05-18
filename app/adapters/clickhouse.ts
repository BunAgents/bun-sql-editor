import { createClient } from "@clickhouse/client";
import type { QueryResult, SchemaResult, TestResult, ColumnsResult, ErdResult } from "../types";

function makeClient(connection: Record<string, unknown>) {
  const host = String(connection.host ?? "http://localhost:8123");
  return createClient({
    host: host.startsWith("http") ? host : `http://${host}`,
    username: String(connection.user ?? "default"),
    password: String(connection.password ?? ""),
    database: String(connection.database ?? "").trim() || "default",
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

    return { columns, rows, rowCount: rows.length, elapsedMs: performance.now() - started };
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
    const result = await client.query({ query: "SELECT version() AS version", format: "JSONEachRow" });
    const rows = (await result.json()) as Array<{ version: string }>;
    const ver = rows[0]?.version ?? "Connected";
    await client.close();
    return { ok: true, message: `ClickHouse ${ver}`, elapsedMs: performance.now() - started };
  } catch (err) {
    await client.close();
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed", elapsedMs: performance.now() - started };
  }
}

export async function schemaClickhouse(
  connection: Record<string, unknown>,
): Promise<SchemaResult> {
  const started = performance.now();
  const client = makeClient(connection);

  try {
    // Exclude internal system databases
    const result = await client.query({
      query: `
        SELECT database, name, engine
        FROM system.tables
        WHERE is_temporary = 0
          AND database NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA')
        ORDER BY database, name
      `,
      format: "JSONEachRow",
    });

    const rows = (await result.json()) as Array<{ database: string; name: string; engine: string }>;
    const items: SchemaResult["items"] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      if (!seen.has(row.database)) {
        items.push({ name: row.database, type: "schema" });
        seen.add(row.database);
      }
      const isView = row.engine === "View" || row.engine === "MaterializedView";
      const isMat = row.engine === "MaterializedView";
      items.push({
        name: row.name,
        type: isMat ? "matview" : isView ? "view" : "table",
        parent: row.database,
      });
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
        SELECT
          name,
          type                                    AS data_type,
          (startsWith(type, 'Nullable'))          AS nullable,
          (is_in_primary_key = 1)                 AS is_primary
        FROM system.columns
        WHERE database = {db:String}
          AND table    = {tbl:String}
        ORDER BY position
      `,
      query_params: {
        db: schema ?? String(connection.database ?? "default"),
        tbl: table,
      },
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<{ name: string; data_type: string; nullable: number; is_primary: number }>;
    return {
      columns: rows.map(r => ({
        name: r.name,
        dataType: r.data_type,
        nullable: r.nullable === 1,
        isPrimary: r.is_primary === 1,
      })),
      elapsedMs: performance.now() - started,
    };
  } finally {
    await client.close();
  }
}

// ClickHouse has no native FK constraints — ERD shows tables + columns only
export async function erdClickhouse(
  connection: Record<string, unknown>,
  schema: string,
): Promise<ErdResult> {
  const started = performance.now();
  const client = makeClient(connection);

  try {
    const result = await client.query({
      query: `
        SELECT
          c.table                               AS table_name,
          c.name                                AS column_name,
          c.type                                AS data_type,
          startsWith(c.type, 'Nullable')        AS nullable,
          (c.is_in_primary_key = 1)             AS is_primary
        FROM system.columns c
        INNER JOIN system.tables t
          ON t.database = c.database AND t.name = c.table
        WHERE c.database = {db:String}
          AND t.engine NOT IN ('View', 'MaterializedView')
          AND t.is_temporary = 0
        ORDER BY c.table, c.position
      `,
      query_params: { db: schema },
      format: "JSONEachRow",
    });

    type Row = { table_name: string; column_name: string; data_type: string; nullable: number; is_primary: number };
    const rows = (await result.json()) as Row[];

    const tableMap = new Map<string, { schema: string; name: string; columns: ColumnsResult["columns"] }>();
    for (const r of rows) {
      if (!tableMap.has(r.table_name)) {
        tableMap.set(r.table_name, { schema, name: r.table_name, columns: [] });
      }
      tableMap.get(r.table_name)!.columns.push({
        name: r.column_name,
        dataType: r.data_type,
        nullable: r.nullable === 1,
        isPrimary: r.is_primary === 1,
      });
    }

    return {
      tables: [...tableMap.values()],
      relations: [], // ClickHouse has no FK constraints
      elapsedMs: performance.now() - started,
    };
  } finally {
    await client.close();
  }
}
