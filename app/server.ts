import { runPostgres, schemaPostgres, testPostgres, columnsPostgres, erdPostgres } from "./adapters/postgres";
import { runMysql, schemaMysql, testMysql, columnsMysql } from "./adapters/mysql";
import { runMongo, schemaMongo, testMongo } from "./adapters/mongodb";
import { runClickhouse, schemaClickhouse, testClickhouse, columnsClickhouse } from "./adapters/clickhouse";
import type { QueryRequest, SchemaRequest, TestRequest, ColumnsRequest, ErdRequest } from "./types";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
} as const;

function contentType(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")) as keyof typeof MIME;
  return MIME[ext] ?? "text/plain; charset=utf-8";
}

async function queryRouter(body: QueryRequest) {
  switch (body.type) {
    case "postgres":
      return runPostgres(body.connection, body.query);
    case "mysql":
      return runMysql(body.connection, body.query);
    case "mongodb":
      return runMongo(body.connection, body.query);
    case "clickhouse":
      return runClickhouse(body.connection, body.query);
    default:
      throw new Error("Unsupported database type");
  }
}

async function testRouter(body: TestRequest) {
  switch (body.type) {
    case "postgres":
      return testPostgres(body.connection);
    case "mysql":
      return testMysql(body.connection);
    case "mongodb":
      return testMongo(body.connection);
    case "clickhouse":
      return testClickhouse(body.connection);
    default:
      throw new Error("Unsupported database type");
  }
}

async function schemaRouter(body: SchemaRequest) {
  switch (body.type) {
    case "postgres":
      return schemaPostgres(body.connection);
    case "mysql":
      return schemaMysql(body.connection);
    case "mongodb":
      return schemaMongo(body.connection);
    case "clickhouse":
      return schemaClickhouse(body.connection);
    default:
      throw new Error("Unsupported database type");
  }
}

async function columnsRouter(body: ColumnsRequest) {
  switch (body.type) {
    case "postgres":
      return columnsPostgres(body.connection, body.schema, body.table);
    case "mysql":
      return columnsMysql(body.connection, body.schema, body.table);
    case "clickhouse":
      return columnsClickhouse(body.connection, body.schema, body.table);
    case "mongodb":
      return { columns: [], elapsedMs: 0 }; // MongoDB is schemaless
    default:
      throw new Error("Unsupported database type");
  }
}

const BUILD_TIME = Date.now().toString(36);

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/query" && req.method === "POST") {
      try {
        const body = (await req.json()) as QueryRequest;
        const result = await queryRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/test" && req.method === "POST") {
      try {
        const body = (await req.json()) as TestRequest;
        const result = await testRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { ok: false, message: error instanceof Error ? error.message : "Unknown error", elapsedMs: 0 },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/schema" && req.method === "POST") {
      try {
        const body = (await req.json()) as SchemaRequest;
        const result = await schemaRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/columns" && req.method === "POST") {
      try {
        const body = (await req.json()) as ColumnsRequest;
        const result = await columnsRouter(body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 400 },
        );
      }
    }

    if (url.pathname === "/api/erd" && req.method === "POST") {
      try {
        const body = (await req.json()) as ErdRequest;
        if (body.type !== "postgres") return Response.json({ tables: [], relations: [], elapsedMs: 0 });
        const result = await erdPostgres(body.connection, body.schema);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          { status: 400 },
        );
      }
    }

    // Strip cache-busting query param for static files
    const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const pathname = rawPath;
    const file = Bun.file(`./src/public${pathname}`);

    if (await file.exists()) {
      // Inject build version into HTML for cache busting
      if (pathname === "/index.html") {
        let html = await file.text();
        html = html.replace('src="/app.js"', `src="/app.js?v=${BUILD_TIME}"`);
        html = html.replace('href="/styles.css"', `href="/styles.css?v=${BUILD_TIME}"`);
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
        });
      }
      // Strip ?v=... from path to serve actual file
      const filePath = url.pathname === "/" ? "/index.html" : url.pathname.split("?")[0];
      const actualFile = Bun.file(`./src/public${filePath}`);
      const noStore = filePath.endsWith(".js") || filePath.endsWith(".css");
      return new Response(actualFile, {
        headers: {
          "content-type": contentType(filePath),
          "cache-control": noStore ? "no-store" : "no-cache",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`SQL editor running on http://localhost:${server.port}`);
