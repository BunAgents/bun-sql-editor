import type { Connection, Tab, SchemaItem, ColumnInfo, QueryHistoryEntry, QueryMeta } from "../core/types";

export type AppState = {
  connections: Connection[];
  activeConnId: string | null;
  tabs: Tab[];
  activeTabId: string | null;
  schemaItems: SchemaItem[];
  columnCache: Map<string, ColumnInfo[] | "loading" | "error">;
  lastColumns: string[];
  lastRows: Array<Record<string, unknown>>;
  lastQueryMeta: QueryMeta | null;
  sortCol: string | null;
  sortDir: "asc" | "desc";
  sidebarOpen: boolean;
  queryHistory: QueryHistoryEntry[];
};

export const S: AppState = {
  connections: [],
  activeConnId: null,
  tabs: [],
  activeTabId: null,
  schemaItems: [],
  columnCache: new Map(),
  lastColumns: [],
  lastRows: [],
  lastQueryMeta: null,
  sortCol: null,
  sortDir: "asc",
  sidebarOpen: true,
  queryHistory: [],
};

export function activeConn(): Connection | null {
  return S.connections.find(c => c.id === S.activeConnId) ?? null;
}

export function activeTab(): Tab | null {
  return S.tabs.find(t => t.id === S.activeTabId) ?? null;
}
