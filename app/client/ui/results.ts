import { el } from "./dom";
import { S, activeConn } from "../data/state";
import { setStatus } from "./status";
import { apiQuery } from "../data/api";
import { buildConnPayload } from "../data/api";
import { sortedRows, csvEscape } from "../core/utils";
export { sortedRows, csvEscape } from "../core/utils";

export function clearResults(): void {
  el.resultsBody.textContent = "";
  el.resultsBody.appendChild(el.resultsEmpty);
  el.resultsEmpty.hidden = false;
  el.resultsCount.hidden = true;
  el.resultsTime.hidden  = true;
  el.copyJsonBtn.hidden  = true;
  el.exportCsvBtn.hidden = true;
}

export function showLoading(): void {
  el.resultsBody.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "result-loading";
  const sp = document.createElement("span");
  sp.className = "spinner";
  wrap.appendChild(sp);
  wrap.appendChild(document.createTextNode(" Running…"));
  el.resultsBody.appendChild(wrap);
}

export function showError(msg: string): void {
  el.resultsBody.textContent = "";
  const box = document.createElement("div");
  box.className = "result-error";
  box.textContent = `⚠ ${msg}`;
  el.resultsBody.appendChild(box);
}

export function renderResultTable(cols: string[], rows: Array<Record<string, unknown>>): void {
  el.resultsBody.textContent = "";

  if (!cols.length && !rows.length) {
    const ok = document.createElement("div");
    ok.className = "result-ok-empty";
    ok.textContent = "Query executed successfully — no rows returned.";
    el.resultsBody.appendChild(ok);
    return;
  }

  const sorted = sortedRows(rows);
  el.resultsBody.appendChild(buildTable(cols, sorted));
}

function buildTable(cols: string[], rows: Array<Record<string, unknown>>): HTMLTableElement {
  const tbl = document.createElement("table");
  tbl.className = "rtable";

  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  for (const col of cols) {
    const th = document.createElement("th");
    const wrap = document.createElement("div");
    wrap.className = "th-wrap";
    wrap.appendChild(document.createTextNode(col));
    if (S.sortCol === col) {
      const arrow = document.createElement("span");
      arrow.className = "sort-arrow";
      arrow.textContent = S.sortDir === "asc" ? "↑" : "↓";
      wrap.appendChild(arrow);
    }
    th.appendChild(wrap);
    th.addEventListener("click", () => {
      S.sortDir = S.sortCol === col && S.sortDir === "asc" ? "desc" : "asc";
      S.sortCol = col;
      renderResultTable(S.lastColumns, S.lastRows);
    });
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  tbl.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const tr = document.createElement("tr");
    for (const col of cols) {
      const td = document.createElement("td");
      const val = row[col];
      if (val == null) {
        td.textContent = "NULL"; td.className = "cell-null";
      } else if (typeof val === "boolean") {
        td.textContent = String(val); td.className = "cell-bool";
      } else if (typeof val === "number") {
        td.textContent = String(val); td.className = "cell-num";
      } else if (typeof val === "object") {
        td.textContent = JSON.stringify(val);
      } else {
        td.textContent = String(val);
      }
      td.addEventListener("dblclick", () => enableInlineEdit(td, ri, col));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);
  return tbl;
}

async function enableInlineEdit(td: HTMLTableCellElement, rowIdx: number, colName: string): Promise<void> {
  if (td.dataset.editing) return;
  td.dataset.editing = "1";
  const orig = S.lastRows[rowIdx]?.[colName];
  const origText = orig == null ? "" : String(orig);
  const inp = document.createElement("input");
  inp.className = "result-inline-inp";
  inp.value = origText;
  td.textContent = "";
  td.appendChild(inp);
  inp.focus();
  inp.select();

  const commit = async () => {
    const newVal = inp.value;
    delete td.dataset.editing;
    if (newVal === origText) { renderResultTable(S.lastColumns, S.lastRows); return; }

    const meta = S.lastQueryMeta;
    if (!meta?.table) {
      td.textContent = origText || "NULL";
      alert("Cannot edit: query must be a simple SELECT from a single table.");
      return;
    }
    const pkCols = S.columnCache.get(`${meta.schema ?? "public"}.${meta.table}`);
    if (!pkCols || pkCols === "loading" || pkCols === "error") {
      td.textContent = origText || "NULL";
      alert("Cannot edit: column metadata not loaded yet. Expand the table in sidebar first.");
      return;
    }
    const pkCol = pkCols.find(c => c.isPrimary);
    if (!pkCol) { td.textContent = origText || "NULL"; alert("Cannot edit: no primary key found."); return; }
    const pkVal = S.lastRows[rowIdx]?.[pkCol.name];
    if (pkVal == null) { td.textContent = origText || "NULL"; alert("Cannot edit: PK value is null."); return; }

    const schemaRef = meta.schema ? `"${meta.schema}".` : "";
    const valLit = newVal === "" ? "NULL" : `'${newVal.replace(/'/g, "''")}'`;
    const sql = `UPDATE ${schemaRef}"${meta.table}" SET "${colName}" = ${valLit} WHERE "${pkCol.name}" = '${String(pkVal).replace(/'/g, "''")}';`;

    try {
      const conn = activeConn()!;
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: conn.type, connection: buildConnPayload(conn), query: sql }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok || data.error) throw new Error((data.error as string) || "Update failed");
      S.lastRows[rowIdx][colName] = newVal === "" ? null : newVal;
      setStatus("ok", `Updated ${meta.table}.${colName}`);
    } catch (e) {
      setStatus("error", `Update failed: ${(e as Error).message}`);
    }
    renderResultTable(S.lastColumns, S.lastRows);
  };

  inp.addEventListener("blur", commit);
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); inp.blur(); }
    if (e.key === "Escape") {
      delete td.dataset.editing;
      inp.removeEventListener("blur", commit);
      renderResultTable(S.lastColumns, S.lastRows);
    }
  });
}

export function doExportCsv(): void {
  const { lastColumns: cols, lastRows: rows } = S;
  if (!cols.length) return;
  const lines = [cols.map(csvEscape).join(",")];
  for (const row of rows) lines.push(cols.map(c => csvEscape(row[c] == null ? "" : String(row[c]))).join(","));
  download(lines.join("\r\n"), "result.csv", "text/csv");
}

export function doCopyJson(): void {
  navigator.clipboard.writeText(JSON.stringify(S.lastRows, null, 2))
    .then(() => setStatus("ok", "Copied JSON to clipboard"));
}

function download(text: string, name: string, mime: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
