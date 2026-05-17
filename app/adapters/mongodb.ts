import { MongoClient } from "mongodb";
import type { QueryResult, SchemaResult, TestResult, ColumnsResult } from "../types";

type MongoQueryShape = {
  collection: string;
  action?: "find" | "aggregate" | "count" | "distinct" | "findOne";
  filter?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  pipeline?: Array<Record<string, unknown>>;
  field?: string; // for distinct
};

function getConnection(connection: Record<string, unknown>) {
  const uri = String(connection.uri ?? "");
  const dbName = String(connection.database ?? "");
  if (!uri || !dbName) throw new Error("MongoDB requires connection.uri and connection.database");
  return { uri, dbName };
}

function flattenDoc(doc: Record<string, unknown>, prefix = "", depth = 0): Record<string, unknown> {
  if (depth > 2) return doc;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      Object.assign(out, flattenDoc(v as Record<string, unknown>, key, depth + 1));
    } else {
      out[key] = v;
    }
  }
  return out;
}

export async function runMongo(
  connection: Record<string, unknown>,
  query: string,
): Promise<QueryResult> {
  const started = performance.now();
  const { uri, dbName } = getConnection(connection);

  let parsed: MongoQueryShape;
  try {
    parsed = JSON.parse(query) as MongoQueryShape;
  } catch {
    throw new Error("MongoDB query must be valid JSON. Example: {\"collection\":\"users\",\"action\":\"find\",\"filter\":{\"active\":true},\"limit\":50}");
  }

  if (!parsed.collection) throw new Error("MongoDB query JSON must include a 'collection' field");

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();

  try {
    const db = client.db(dbName);
    const col = db.collection(parsed.collection);
    const action = parsed.action ?? "find";
    let rows: Array<Record<string, unknown>> = [];

    if (action === "aggregate") {
      rows = (await col.aggregate(parsed.pipeline ?? [], { maxTimeMS: 30_000 }).toArray()) as Array<Record<string, unknown>>;
    } else if (action === "count") {
      const count = await col.countDocuments(parsed.filter ?? {});
      rows = [{ count }];
    } else if (action === "distinct") {
      if (!parsed.field) throw new Error("'distinct' action requires a 'field' property");
      const vals = await col.distinct(parsed.field, parsed.filter ?? {});
      rows = vals.map(v => ({ value: v }));
    } else if (action === "findOne") {
      const doc = await col.findOne(parsed.filter ?? {}, { projection: parsed.projection, maxTimeMS: 10_000 });
      rows = doc ? [doc as Record<string, unknown>] : [];
    } else {
      rows = (await col.find(parsed.filter ?? {}, {
        projection: parsed.projection,
        sort: parsed.sort,
        limit: parsed.limit ?? 100,
        skip: parsed.skip ?? 0,
        maxTimeMS: 30_000,
      }).toArray()) as Array<Record<string, unknown>>;
    }

    // Derive consistent columns from all rows (union of keys)
    const colSet = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) colSet.add(k);
    }
    const columns = [...colSet];

    return { columns, rows, rowCount: rows.length, elapsedMs: performance.now() - started };
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
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });
    await client.connect();
    const info = await client.db(dbName).command({ buildInfo: 1 });
    await client.close();
    const ver = String(info?.version ?? "Connected");
    return { ok: true, message: `MongoDB ${ver} · db: ${dbName}`, elapsedMs: performance.now() - started };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed", elapsedMs: performance.now() - started };
  }
}

export async function schemaMongo(
  connection: Record<string, unknown>,
): Promise<SchemaResult> {
  const started = performance.now();
  const { uri, dbName } = getConnection(connection);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });
  await client.connect();

  try {
    const db = client.db(dbName);
    const collections = await db.listCollections({}, { nameOnly: false }).toArray();

    const items: SchemaResult["items"] = [{ name: dbName, type: "schema" }];

    for (const c of collections) {
      items.push({
        name: c.name,
        type: c.type === "view" ? "view" : "collection",
        parent: dbName,
      });
    }

    return { items, elapsedMs: performance.now() - started };
  } finally {
    await client.close();
  }
}

// Sample up to 20 documents to infer field names and types
export async function columnsMongo(
  connection: Record<string, unknown>,
  _schema: string | undefined,
  collection: string,
): Promise<ColumnsResult> {
  const started = performance.now();
  const { uri, dbName } = getConnection(connection);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });
  await client.connect();

  try {
    const docs = await client.db(dbName).collection(collection)
      .find({}, { limit: 20, maxTimeMS: 5_000 }).toArray() as Array<Record<string, unknown>>;

    const fieldMap = new Map<string, Set<string>>();
    for (const doc of docs) {
      const flat = flattenDoc(doc as Record<string, unknown>);
      for (const [k, v] of Object.entries(flat)) {
        if (!fieldMap.has(k)) fieldMap.set(k, new Set());
        fieldMap.get(k)!.add(v === null ? "null" : typeof v);
      }
    }

    const columns = [...fieldMap.entries()].map(([name, types]) => ({
      name,
      dataType: [...types].join(" | "),
      nullable: types.has("null") || types.has("undefined"),
      isPrimary: name === "_id",
    }));

    return { columns, elapsedMs: performance.now() - started };
  } finally {
    await client.close();
  }
}
