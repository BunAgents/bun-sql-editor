import { el } from "./dom";
import { S } from "../data/state";
import { save } from "../data/persistence";
import { updateGutter, updateHighlight } from "./editor";
import { flushTabContent } from "./tabs";

export function historyPush(sql: string, connName: string, elapsedMs: number, rowCount: number): void {
  S.queryHistory.unshift({ sql: sql.trim(), connName, ts: Date.now(), elapsedMs: Math.round(elapsedMs), rowCount });
  if (S.queryHistory.length > 200) S.queryHistory.length = 200;
  save();
}

export function renderQueryHistory(): void {
  el.qhistList.textContent = "";
  if (!S.queryHistory.length) {
    const empty = document.createElement("div");
    empty.className = "qhist-empty";
    empty.textContent = "No queries yet.";
    el.qhistList.appendChild(empty);
    return;
  }
  for (const entry of S.queryHistory) {
    const item = document.createElement("div");
    item.className = "qhist-item";

    const meta = document.createElement("div");
    meta.className = "qhist-meta";
    const date = new Date(entry.ts);
    meta.textContent = `${date.toLocaleTimeString()} · ${entry.connName} · ${entry.rowCount} rows · ${entry.elapsedMs}ms`;

    const sql = document.createElement("div");
    sql.className = "qhist-sql";
    sql.textContent = entry.sql.length > 120 ? entry.sql.slice(0, 120) + "…" : entry.sql;

    item.appendChild(meta);
    item.appendChild(sql);
    item.addEventListener("click", () => {
      el.editor.value = entry.sql;
      flushTabContent();
      save();
      updateGutter();
      updateHighlight();
      el.qhistPanel.hidden = true;
      el.editor.focus();
    });
    el.qhistList.appendChild(item);
  }
}

export function toggleHistory(): void {
  const hidden = el.qhistPanel.hidden;
  el.qhistPanel.hidden = !hidden;
  if (!hidden) return;
  renderQueryHistory();
}
