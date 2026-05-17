import { el } from "./dom";
import { S, activeConn } from "../data/state";
import { save } from "../data/persistence";
import { setStatus } from "./status";
import { apiQuery } from "../data/api";
import { renderResultTable, showLoading, showError } from "./results";
import { flushTabContent } from "./tabs";
import { historyPush } from "./history";
import type { SchemaItem } from "../core/types";

export function makeQueryTemplate(item: SchemaItem): string {
  const dbType = activeConn()?.type ?? "postgres";
  const q = (s: string) => `"${s}"`;
  const ref = item.parent ? `${q(item.parent)}.${q(item.name)}` : q(item.name);

  if (dbType === "mongodb") {
    const base = { collection: item.name, action: "find", filter: {}, limit: 100 };
    return JSON.stringify(base, null, 2)
      + "\n\n// Other actions:\n"
      + `// {"collection":"${item.name}","action":"count","filter":{}}\n`
      + `// {"collection":"${item.name}","action":"distinct","field":"_id","filter":{}}\n`
      + `// {"collection":"${item.name}","action":"aggregate","pipeline":[{"$match":{}},{"$limit":100}]}`;
  }
  if (dbType === "clickhouse") {
    const ref2 = item.parent ? `${item.parent}.${item.name}` : item.name;
    return item.type === "function"
      ? `-- function: ${ref2}\nSELECT ${ref2}();`
      : `SELECT *\nFROM ${ref2}\nLIMIT 100;`;
  }

  switch (item.type) {
    case "view":
    case "matview":   return `SELECT *\nFROM ${ref}\nLIMIT 100;`;
    case "function":  return `-- function: ${ref}\nSELECT ${ref}();`;
    case "index":     return `SELECT indexname, indexdef\nFROM pg_indexes\nWHERE schemaname = '${item.parent}'\n  AND indexname = '${item.name}';`;
    case "sequence":  return `SELECT * FROM ${ref};`;
    case "trigger":   return `SELECT trigger_name, event_manipulation, event_object_table, action_statement\nFROM information_schema.triggers\nWHERE trigger_schema = '${item.parent}'\n  AND trigger_name = '${item.name}';`;
    default:          return item.parent
      ? `SELECT *\nFROM ${ref}\nLIMIT 100;`
      : `SELECT table_name FROM information_schema.tables WHERE table_schema = '${item.name}';`;
  }
}

export async function runQuery(): Promise<void> {
  flushTabContent();
  save();

  const conn = activeConn();
  if (!conn) { setStatus("error", "No connection selected"); return; }

  const query = el.editor.value.trim();
  if (!query) { setStatus("idle", "Nothing to run"); return; }

  setStatus("loading", "Running…");
  showLoading();

  try {
    const data = await apiQuery(query);
    const cols = data.columns as string[];
    const rows = data.rows as Array<Record<string, unknown>>;

    S.lastColumns = cols;
    S.lastRows    = rows;
    S.sortCol     = null;
    S.sortDir     = "asc";

    const fromMatch =
      query.match(/^\s*SELECT\s+[\s\S]*?\bFROM\s+"?(\w+)"?\."?(\w+)"?\s*(?:LIMIT|ORDER|WHERE|$)/i) ||
      query.match(/^\s*SELECT\s+[\s\S]*?\bFROM\s+"?(\w+)"?\s*(?:LIMIT|ORDER|WHERE|$)/i);
    S.lastQueryMeta = fromMatch
      ? { schema: fromMatch[2] ? fromMatch[1] : null, table: fromMatch[2] ?? fromMatch[1] }
      : null;

    historyPush(query, conn.name, data.elapsedMs as number, data.rowCount as number);

    renderResultTable(cols, rows);
    el.resultsCount.textContent = `${data.rowCount} rows`;
    el.resultsCount.hidden = false;
    el.resultsTime.textContent  = `${Math.round(data.elapsedMs as number)} ms`;
    el.resultsTime.hidden = false;
    el.copyJsonBtn.hidden = false;
    el.exportCsvBtn.hidden = false;
    setStatus("ok", `${conn.type} · ${data.rowCount} rows · ${Math.round(data.elapsedMs as number)} ms`);
  } catch (err) {
    showError((err as Error).message);
    el.resultsCount.hidden = true;
    el.resultsTime.hidden  = true;
    el.copyJsonBtn.hidden  = true;
    el.exportCsvBtn.hidden = true;
    const hint = /relation.*does not exist/i.test((err as Error).message)
      ? " (tip: use double quotes for case-sensitive names, e.g. \"Schema\".\"Table\")"
      : "";
    setStatus("error", `Error: ${(err as Error).message}${hint}`);
  }
}

export async function runExplain(): Promise<void> {
  const conn = activeConn();
  if (!conn) return;
  const q = el.editor.value.trim();
  if (!q) return;
  let explain = q;
  if (conn.type === "postgres") explain = `EXPLAIN ANALYZE\n${q}`;
  else if (conn.type === "mysql") explain = `EXPLAIN ${q}`;
  else if (conn.type === "clickhouse") explain = `EXPLAIN ${q}`;
  el.editor.value = explain;
  flushTabContent();
  import("./editor").then(e => { e.updateGutter(); e.updateHighlight(); });
  await runQuery();
}

export async function executeDdl(sql: string): Promise<void> {
  const conn = activeConn();
  if (!conn) { setStatus("error", "No connection selected"); return; }
  setStatus("loading", "Executing…");
  try {
    await apiQuery(sql);
    setStatus("ok", "Statement executed");
    import("./schema").then(m => m.loadSchema());
  } catch (err) {
    setStatus("error", `DDL Error: ${(err as Error).message}`);
    alert(`Error: ${(err as Error).message}`);
    throw err;
  }
}
