import { MongoClient } from "mongodb";
import type { QueryResult, SchemaResult, TestResult } from "../types";

type MongoQueryShape = {
  collection: string;
  action?: "find" | "aggregate";
  filter?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  pipeline?: Array<Record<string, unknown>>;
};

function getConnection(connection: Record<string, unknown>) {
  const uri = String(connection.uri ?? "");
  const dbName = String(connection.database ?? "");
  if (!uri || !dbName) {
    throw new Error("MongoDB requires connection.uri and connection.database");
  }
  return { uri, dbName };
}

export async function runMongo(
  connection: Record<string, unknown>,
  query: string,
): Promise<QueryResult> {
  const started = performance.now();
  const { uri, dbName } = getConnection(connection);

  const parsed = JSON.parse(query) as MongoQueryShape;
  if (!parsed.collection) {
    throw new Error("MongoDB query JSON must include a 'collection' field");
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const collection = db.collection(parsed.collection);
    const action = parsed.action ?? "find";

    let rows: Array<Record<string, unknown>> = [];

    if (action === "aggregate") {
      rows = (await collection
        .aggregate(parsed.pipeline ?? [], { maxTimeMS: 30_000 })
        .toArray()) as Array<Record<string, unknown>>;
    } else {
      rows = (await collection
        .find(parsed.filter ?? {}, {
          projection: parsed.projection,
          sort: parsed.sort,
          limit: parsed.limit ?? 100,
          maxTimeMS: 30_000,
        })
        .toArray()) as Array<Record<string, unknown>>;
    }

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

export async function testMongo(
  connection: Record<string, unknown>,
): Promise<TestResult> {
  const started = performance.now();
  try {
    const { uri, dbName } = getConnection(connection);
    const client = new MongoClient(uri);
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
    await client.close();
    return { ok: true, message: `MongoDB connected to ${dbName}`, elapsedMs: performance.now() - started };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed", elapsedMs: performance.now() - started };
  }
}

export async function schemaMongo(
  connection: Record<string, unknown>,
): Promise<SchemaResult> {
  const started = performance.now();
  const { uri, dbName } = getConnection(connection);
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    return {
      items: collections.map((c) => ({
        name: c.name,
        type: "collection" as const,
        parent: dbName,
      })),
      elapsedMs: performance.now() - started,
    };
  } finally {
    await client.close();
  }
}
