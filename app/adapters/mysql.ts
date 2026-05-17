import mysql from "mysql2/promise";
import type { QueryResult, SchemaResult, TestResult, ColumnsResult } from "../types";

function makeConnection(connection: Record<string, unknown>) {
  return mysql.createConnection({
    host: String(connection.host ?? "localhost"),
    port: Number(connection.port ?? 3306),
    user: String(connection.user ?? "root"),
    password: String(connection.password ?? ""),
    database: String(connection.database ?? "mysql"),
    ssl: connection.ssl ? {} : undefined,
  });
}

export async function runMysql(
  connection: Record<string, unknown>,
  query: string,
): Promise<QueryResult> {
  const started = performance.now();
  const conn = await makeConnection(connection);

  try {
    const [rows] = await conn.query(query);
    const normalizedRows = Array.isArray(rows)
      ? (rows as Array<Record<string, unknown>>)
      : [];
    const columns = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];

    return {
      columns,
      rows: normalizedRows,
      rowCount: normalizedRows.length,
      elapsedMs: performance.now() - started,
    };
  } finally {
    await conn.end();
  }
}

export async function testMysql(
  connection: Record<string, unknown>,
): Promise<TestResult> {
  const started = performance.now();
  try {
    const conn = await makeConnection(connection);
    const [rows] = await conn.query("SELECT VERSION() AS version");
    await conn.end();
    const ver = (rows as Array<{ version: string }>)[0]?.version ?? "Connected";
    return { ok: true, message: `MySQL ${ver}`, elapsedMs: performance.now() - started };
  } catch (err) {
    const msg = err instanceof Error ? (err.message || "Connection refused") : "Connection failed";
    return { ok: false, message: msg, elapsedMs: performance.now() - started };
  }
}

export async function schemaMysql(
  connection: Record<string, unknown>,
): Promise<SchemaResult> {
  const started = performance.now();
  const conn = await makeConnection(connection);

  try {
    const [rows] = await conn.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const items = (rows as Array<{ table_name: string }>).map((row) => ({
      name: row.table_name,
      type: "table" as const,
      parent: String(connection.database ?? "mysql"),
    }));

    return { items, elapsedMs: performance.now() - started };
  } finally {
    await conn.end();
  }
}

export async function columnsMysql(
  connection: Record<string, unknown>,
  _schema: string | undefined,
  table: string,
): Promise<ColumnsResult> {
  const started = performance.now();
  const conn = await makeConnection(connection);
  try {
    const [rows] = await conn.query(`
      SELECT
        c.COLUMN_NAME      AS name,
        c.DATA_TYPE        AS data_type,
        c.IS_NULLABLE = 'YES' AS nullable,
        c.COLUMN_KEY = 'PRI'  AS is_primary
      FROM information_schema.COLUMNS c
      WHERE c.TABLE_SCHEMA = DATABASE()
        AND c.TABLE_NAME   = ?
      ORDER BY c.ORDINAL_POSITION
    `, [table]);
    return {
      columns: (rows as Array<{ name: string; data_type: string; nullable: number; is_primary: number }>).map(r => ({
        name: r.name,
        dataType: r.data_type,
        nullable: Boolean(r.nullable),
        isPrimary: Boolean(r.is_primary),
      })),
      elapsedMs: performance.now() - started,
    };
  } finally {
    await conn.end();
  }
}
