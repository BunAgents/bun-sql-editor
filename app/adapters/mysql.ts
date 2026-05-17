import mysql from "mysql2/promise";
import type { QueryResult, SchemaResult, TestResult, ColumnsResult, ErdResult, FkRelation, ErdTable } from "../types";

function makeConnection(connection: Record<string, unknown>) {
  return mysql.createConnection({
    host: String(connection.host ?? "localhost"),
    port: Number(connection.port ?? 3306),
    user: String(connection.user ?? "root"),
    password: String(connection.password ?? ""),
    database: String(connection.database ?? "mysql"),
    ssl: connection.ssl ? {} : undefined,
    multipleStatements: false,
  });
}

export async function runMysql(
  connection: Record<string, unknown>,
  query: string,
): Promise<QueryResult> {
  const started = performance.now();
  const conn = await makeConnection(connection);
  try {
    const [rows, fields] = await conn.query(query);
    const normalizedRows = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
    const columns = (fields as Array<{ name: string }> | undefined)?.map(f => f.name)
      ?? (normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : []);
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
  const db = String(connection.database ?? "mysql");

  try {
    const [tables] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_type, table_name
    `);

    const [routines] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = DATABASE()
      ORDER BY routine_name
    `);

    const [triggers] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = DATABASE()
      ORDER BY trigger_name
    `);

    const items: SchemaResult["items"] = [{ name: db, type: "schema" }];

    for (const row of tables) {
      items.push({
        name: String(row.table_name),
        type: row.table_type === "VIEW" ? "view" : "table",
        parent: db,
      });
    }

    for (const row of routines) {
      items.push({
        name: String(row.routine_name),
        type: "function",
        parent: db,
      });
    }

    for (const row of triggers) {
      items.push({
        name: String(row.trigger_name),
        type: "trigger",
        parent: db,
      });
    }

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
    const [rows] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT
        c.COLUMN_NAME                  AS name,
        c.COLUMN_TYPE                  AS data_type,
        (c.IS_NULLABLE = 'YES')        AS nullable,
        (c.COLUMN_KEY = 'PRI')         AS is_primary
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

export async function erdMysql(
  connection: Record<string, unknown>,
  schema: string,
): Promise<ErdResult> {
  const started = performance.now();
  const conn = await makeConnection(connection);
  const db = schema || String(connection.database ?? "mysql");

  try {
    const [colRows] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT
        c.TABLE_NAME,
        c.COLUMN_NAME,
        c.COLUMN_TYPE      AS data_type,
        (c.IS_NULLABLE = 'YES') AS nullable,
        (c.COLUMN_KEY = 'PRI')  AS is_primary
      FROM information_schema.COLUMNS c
      INNER JOIN information_schema.TABLES t
        ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
      WHERE c.TABLE_SCHEMA = ?
        AND t.TABLE_TYPE   = 'BASE TABLE'
      ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
    `, [db]);

    const tableMap = new Map<string, ErdTable>();
    for (const r of colRows as Array<{ TABLE_NAME: string; COLUMN_NAME: string; data_type: string; nullable: number; is_primary: number }>) {
      if (!tableMap.has(r.TABLE_NAME)) {
        tableMap.set(r.TABLE_NAME, { schema: db, name: r.TABLE_NAME, columns: [] });
      }
      tableMap.get(r.TABLE_NAME)!.columns.push({
        name: r.COLUMN_NAME,
        dataType: r.data_type,
        nullable: Boolean(r.nullable),
        isPrimary: Boolean(r.is_primary),
      });
    }

    const [fkRows] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT
        kcu.TABLE_NAME          AS from_table,
        kcu.COLUMN_NAME         AS from_column,
        kcu.REFERENCED_TABLE_NAME  AS to_table,
        kcu.REFERENCED_COLUMN_NAME AS to_column,
        rc.DELETE_RULE          AS on_delete
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_NAME   = kcu.CONSTRAINT_NAME
       AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
      WHERE kcu.TABLE_SCHEMA            = ?
        AND kcu.REFERENCED_TABLE_NAME   IS NOT NULL
      ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME
    `, [db]);

    const relations: FkRelation[] = (fkRows as Array<{
      from_table: string; from_column: string;
      to_table: string; to_column: string; on_delete: string;
    }>).map(r => ({
      fromSchema: db, fromTable: r.from_table, fromColumn: r.from_column,
      toSchema: db, toTable: r.to_table, toColumn: r.to_column,
      onDelete: r.on_delete,
    }));

    return { tables: [...tableMap.values()], relations, elapsedMs: performance.now() - started };
  } finally {
    await conn.end();
  }
}
