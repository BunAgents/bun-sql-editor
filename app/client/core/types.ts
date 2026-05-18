export type DbType = "postgres" | "mysql" | "mongodb" | "clickhouse";

export type Connection = {
  id: string;
  name: string;
  type: DbType;
  host: string;
  uri: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

export type QueryTab = {
  id: string;
  kind?: undefined;
  title: string;
  content: string;
  dbType: DbType;
  connId: string | null;
};

export type TableEditorTab = {
  id: string;
  kind: "table-editor";
  title: string;
  content: string;
  dbType: DbType;
  connId: string | null;
  tblItem: SchemaItem | null;
  tblContext: { schema?: string };
  tblCols: TblCol[] | null;
  tblIndexes: TblIndex[];
  tblFKeys: TblFKey[];
  tblTab: "columns" | "indexes" | "fkeys";
  originalCols: ColumnInfo[] | null;
  loaded: boolean;
};

export type ErdTab = {
  id: string;
  kind: "erd";
  title: string;
  content: string;
  dbType: DbType;
  connId: string | null;
  erdSchema: string;
  erdData: ErdData | null;
  erdPositions: Record<string, { x: number; y: number }>;
  erdZoom: number;
  erdPan: { x: number; y: number };
};

export type Tab = QueryTab | TableEditorTab | ErdTab;

export type SchemaItem = {
  name: string;
  type: "schema" | "table" | "view" | "matview" | "function" | "sequence" | "trigger" | "index" | "collection";
  parent?: string;
};

export type ColumnInfo = {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimary: boolean;
};

export type QueryHistoryEntry = {
  sql: string;
  connName: string;
  ts: number;
  elapsedMs: number;
  rowCount: number;
};

export type TblCol = {
  id: string;
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  pkOrder?: number;
  unique: boolean;
  default: string;
  original: string | null;
};

export type TblIndex = {
  id: string;
  name: string;
  columns: string;
  unique: boolean;
};

export type TblFKey = {
  id: string;
  column: string;
  refTable: string;
  refColumn: string;
  onDelete: string;
};

export type ErdData = {
  tables: ErdTable[];
  relations: FkRelation[];
  elapsedMs: number;
};

export type ErdTable = {
  schema: string;
  name: string;
  columns: ColumnInfo[];
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

export type QueryMeta = {
  schema: string | null;
  table: string;
};

export type AiProvider =
  | "openai"
  | "anthropic"
  | "ollama"
  | "openrouter"
  | "fastrouter"
  | "custom";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  enabled: boolean;
};
