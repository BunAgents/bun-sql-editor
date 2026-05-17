import { activeConn } from "./state";
import type { Connection } from "../core/types";

export function buildConnPayload(conn: Connection): Record<string, unknown> {
  if (conn.type === "mongodb") return { uri: conn.uri || conn.host, database: conn.database };
  return { host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: conn.ssl };
}

export async function apiQuery(query: string): Promise<Record<string, unknown>> {
  const conn = activeConn();
  if (!conn) throw new Error("No connection selected");
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: conn.type, connection: buildConnPayload(conn), query }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || "Query failed");
  return data;
}

export async function apiSchema(): Promise<Record<string, unknown>> {
  const conn = activeConn();
  if (!conn) throw new Error("No connection selected");
  const res = await fetch("/api/schema", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: conn.type, connection: buildConnPayload(conn) }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || "Schema failed");
  return data;
}

export async function apiColumns(schema: string | undefined, table: string): Promise<Record<string, unknown>> {
  const conn = activeConn();
  if (!conn) throw new Error("No connection selected");
  const res = await fetch("/api/columns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: conn.type, connection: buildConnPayload(conn), schema, table }),
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || "Failed");
  return data;
}

export async function apiTest(payload: Record<string, unknown>, type: string): Promise<Record<string, unknown>> {
  const res = await fetch("/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, connection: payload }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export async function apiErd(connId: string, type: string, conn: Record<string, unknown>, schema: string): Promise<Record<string, unknown>> {
  const res = await fetch("/api/erd", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, connection: conn, schema }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}
