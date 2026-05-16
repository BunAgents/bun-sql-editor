import { Client } from "pg";
import type { QueryResult, SchemaResult, TestResult, ColumnsResult } from "../types";

function makeClient(connection: Record<string, unknown>): Client {
  return new Client({
    host: String(connection.host ?? "localhost"),
    port: Number(connection.port ?? 5432),
    user: String(connection.user ?? "postgres"),
    password: String(connection.password ?? ""),
    database: String(connection.database ?? "postgres"),
    ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
  });
}

export async function runPostgres(
  connection: Record<string, unknown>,
  query: string,
): Promise<QueryResult> {
  const client = makeClient(connection);
  const started = performance.now();
  await client.connect();
  try {
    const result = await client.query(query);
    const rows = result.rows as Array<Record<string, unknown>>;
    const columns = result.fields?.map((f: { name: string }) => f.name) ?? [];

    return {
      columns,
      rows,
      rowCount: result.rowCount ?? rows.length,
      elapsedMs: performance.now() - started,
    };
  } finally {
    await client.end();
  }
}

export async function testPostgres(
  connection: Record<string, unknown>,
): Promise<TestResult> {
  const client = makeClient(connection);
  const started = performance.now();
  try {
    await client.connect();
    const res = await client.query("SELECT version()");
    await client.end();
    const raw = String(res.rows[0]?.version ?? "");
    const message = raw ? raw.split("(")[0].trim() : "Connected";
    return { ok: true, message, elapsedMs: performance.now() - started };
  } catch (err) {
    const msg = err instanceof Error ? (err.message || "Connection refused") : "Connection failed";
    return { ok: false, message: msg, elapsedMs: performance.now() - started };
  }
}

export async function schemaPostgres(
  connection: Record<string, unknown>,
): Promise<SchemaResult> {
  const client = makeClient(connection);
  const started = performance.now();
  await client.connect();
  try {
    const allSchemas = await client.query(`
      SELECT nspname AS name
      FROM pg_namespace
      ORDER BY
        CASE WHEN nspname IN ('pg_catalog','information_schema','pg_toast') THEN 1 ELSE 0 END,
        nspname
    `);
    const tables = await client.query(`
      SELECT table_schema AS schema, table_name AS name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
      ORDER BY
        CASE WHEN table_schema IN ('pg_catalog','information_schema','pg_toast') THEN 1 ELSE 0 END,
        table_schema, table_name
    `);
    const views = await client.query(`
      SELECT table_schema AS schema, table_name AS name
      FROM information_schema.views
      ORDER BY
        CASE WHEN table_schema IN ('pg_catalog','information_schema','pg_toast') THEN 1 ELSE 0 END,
        table_schema, table_name
    `);
    const funcs = await client.query(`
      SELECT n.nspname AS schema, p.proname AS name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.prokind IN ('f','p')
      ORDER BY
        CASE WHEN n.nspname IN ('pg_catalog','information_schema','pg_toast') THEN 1 ELSE 0 END,
        n.nspname, p.proname
    `);
    const indexes = await client.query(`
      SELECT schemaname AS schema, indexname AS name
      FROM pg_indexes
      ORDER BY
        CASE WHEN schemaname IN ('pg_catalog','information_schema','pg_toast') THEN 1 ELSE 0 END,
        schemaname, indexname
    `);

    const items: SchemaResult["items"] = [];
    const schemas = new Set<string>();

    const ensureSchema = (s: string) => {
      if (!schemas.has(s)) { items.push({ name: s, type: "schema" }); schemas.add(s); }
    };

    // Register all schemas first so empty schemas still appear
    for (const r of allSchemas.rows) ensureSchema(String(r.name));

    for (const r of tables.rows)  { ensureSchema(String(r.schema)); items.push({ name: String(r.name), type: "table",    parent: String(r.schema) }); }
    for (const r of views.rows)   { ensureSchema(String(r.schema)); items.push({ name: String(r.name), type: "view",     parent: String(r.schema) }); }
    for (const r of funcs.rows)   { ensureSchema(String(r.schema)); items.push({ name: String(r.name), type: "function", parent: String(r.schema) }); }
    for (const r of indexes.rows) { ensureSchema(String(r.schema)); items.push({ name: String(r.name), type: "index",    parent: String(r.schema) }); }

    return { items, elapsedMs: performance.now() - started };
  } finally {
    await client.end();
  }
}

export async function columnsPostgres(
  connection: Record<string, unknown>,
  schema: string | undefined,
  table: string,
): Promise<ColumnsResult> {
  const client = makeClient(connection);
  const started = performance.now();
  await client.connect();
  try {
    const res = await client.query(`
      SELECT
        c.column_name        AS name,
        c.data_type          AS data_type,
        c.is_nullable = 'YES' AS nullable,
        COALESCE(pk.column_name IS NOT NULL, false) AS is_primary
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name   = kcu.table_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name   = $2
      ) pk ON pk.column_name = c.column_name
      WHERE c.table_schema = $1
        AND c.table_name   = $2
      ORDER BY c.ordinal_position
    `, [schema ?? "public", table]);

    return {
      columns: res.rows.map(r => ({
        name: String(r.name),
        dataType: String(r.data_type),
        nullable: Boolean(r.nullable),
        isPrimary: Boolean(r.is_primary),
      })),
      elapsedMs: performance.now() - started,
    };
  } finally {
    await client.end();
  }
}
