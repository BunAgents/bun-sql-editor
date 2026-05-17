export type DbType = "postgres" | "mysql" | "mongodb" | "clickhouse";

export type ConnectionConfig = {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  uri?: string;
};

export type QueryRequest = {
  type: DbType;
  connection: Record<string, unknown>;
  query: string;
};

export type QueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  elapsedMs: number;
};

export type SchemaItem = {
  name: string;
  type: "schema" | "table" | "view" | "matview" | "function" | "sequence" | "trigger" | "index" | "collection";
  parent?: string;
  columns?: ColumnInfo[];
};

export type ColumnInfo = {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimary: boolean;
};

export type SchemaResult = {
  items: SchemaItem[];
  elapsedMs: number;
};

export type SchemaRequest = {
  type: DbType;
  connection: Record<string, unknown>;
};

export type TestRequest = {
  type: DbType;
  connection: Record<string, unknown>;
};

export type ColumnsRequest = {
  type: DbType;
  connection: Record<string, unknown>;
  schema?: string;
  table: string;
};

export type ColumnsResult = {
  columns: ColumnInfo[];
  elapsedMs: number;
};

export type TestResult = {
  ok: boolean;
  message: string;
  elapsedMs: number;
};

export type FkRelation = {
  fromSchema: string;
  fromTable: string;
  fromColumn: string;
  toSchema: string;
  toTable: string;
  toColumn: string;
  onDelete: string;
};

export type ErdTable = {
  schema: string;
  name: string;
  columns: ColumnInfo[];
};

export type ErdRequest = {
  type: DbType;
  connection: Record<string, unknown>;
  schema: string;
};

export type ErdResult = {
  tables: ErdTable[];
  relations: FkRelation[];
  elapsedMs: number;
};
