import { el } from "./dom";
import { activeConn } from "../data/state";
import { openDdlModal, openTableEditor } from "./ddl";
import { openErdTab } from "./erd";
import { executeDdl } from "./query";
import type { SchemaItem } from "../core/types";

type CtxTarget = { type: "schema" | "table"; item: SchemaItem };
let _ctxTarget: CtxTarget | null = null;

export function showCtxMenu(x: number, y: number, target: CtxTarget): void {
  _ctxTarget = target;
  const isSchema = target.type === "schema";
  const isTable  = target.type === "table";
  el.ctxNewTable.textContent = isSchema ? `New Table in "${target.item.name}"` : "New Table here";
  el.ctxOpenErd.hidden    = !isSchema;
  el.ctxDropSchema.hidden = !isSchema;
  el.ctxEditTable.hidden  = !isTable;
  el.ctxDropTable.hidden  = isSchema;
  el.ctxTruncate.hidden   = isSchema;
  el.ctxMaintSep.hidden   = !isTable;
  el.ctxVacuum.hidden     = !isTable;
  el.ctxReindex.hidden    = !isTable;

  el.ctxMenu.hidden = false;
  const mx = Math.min(x, window.innerWidth - 220);
  const my = Math.min(y, window.innerHeight - 180);
  el.ctxMenu.style.left = `${mx}px`;
  el.ctxMenu.style.top  = `${my}px`;
}

export function hideCtxMenu(): void {
  el.ctxMenu.hidden = true;
  _ctxTarget = null;
}

export function initContextMenu(): void {
  el.ctxNewTable.addEventListener("click", () => {
    const ctx = _ctxTarget?.type === "schema" ? { schema: _ctxTarget.item.name } : {};
    hideCtxMenu();
    openDdlModal("table", ctx);
  });

  el.ctxOpenErd.addEventListener("click", () => {
    const item = _ctxTarget?.item;
    if (!item) return;
    hideCtxMenu();
    openErdTab(item.name);
  });

  el.ctxDropSchema.addEventListener("click", async () => {
    const item = _ctxTarget?.item;
    if (!item) return;
    hideCtxMenu();
    if (!confirm(`Drop schema "${item.name}" and ALL its objects? This cannot be undone.`)) return;
    const dbType = activeConn()?.type ?? "postgres";
    const sql = dbType === "mysql"
      ? `DROP DATABASE IF EXISTS \`${item.name}\``
      : `DROP SCHEMA IF EXISTS "${item.name}" CASCADE`;
    await executeDdl(sql);
  });

  el.ctxEditTable.addEventListener("click", () => {
    const item = _ctxTarget?.item;
    if (!item) return;
    hideCtxMenu();
    openTableEditor(item);
  });

  el.ctxDropTable.addEventListener("click", async () => {
    const item = _ctxTarget?.item;
    if (!item) return;
    hideCtxMenu();
    if (!confirm(`Drop table "${item.name}"? This cannot be undone.`)) return;
    const ref = item.parent ? `"${item.parent}"."${item.name}"` : `"${item.name}"`;
    await executeDdl(`DROP TABLE IF EXISTS ${ref}`);
  });

  el.ctxTruncate.addEventListener("click", async () => {
    const item = _ctxTarget?.item;
    if (!item) return;
    hideCtxMenu();
    if (!confirm(`Truncate "${item.name}"? All rows will be deleted.`)) return;
    const ref = item.parent ? `"${item.parent}"."${item.name}"` : `"${item.name}"`;
    await executeDdl(`TRUNCATE TABLE ${ref}`);
  });

  el.ctxVacuum.addEventListener("click", async () => {
    const item = _ctxTarget?.item;
    if (!item) return;
    hideCtxMenu();
    const ref = item.parent ? `"${item.parent}"."${item.name}"` : `"${item.name}"`;
    await executeDdl(`VACUUM ANALYZE ${ref}`);
  });

  el.ctxReindex.addEventListener("click", async () => {
    const item = _ctxTarget?.item;
    if (!item) return;
    hideCtxMenu();
    const ref = item.parent ? `"${item.parent}"."${item.name}"` : `"${item.name}"`;
    await executeDdl(`REINDEX TABLE ${ref}`);
  });

  document.addEventListener("click", hideCtxMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape") hideCtxMenu(); });
}
