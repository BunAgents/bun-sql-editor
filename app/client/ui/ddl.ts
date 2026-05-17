import { el } from "./dom";
import { S, activeConn } from "../data/state";
import { save } from "../data/persistence";
import { apiColumns } from "../data/api";
import { buildConnPayload } from "../data/api";
import { executeDdl } from "./query";
import { renderTabs, switchTab, closeTab, flushTabContent } from "./tabs";
import { syncEditorFromTab } from "./tabs";
import type { SchemaItem, TblCol, TblIndex, TblFKey, ColumnInfo, TableEditorTab } from "../core/types";

const PG_TYPES = ["integer","bigint","smallint","serial","bigserial","text","varchar(255)","char(1)","boolean","numeric(10,2)","real","double precision","date","timestamp","timestamptz","uuid","json","jsonb","bytea","text[]"];
const MY_TYPES = ["INT","BIGINT","SMALLINT","TINYINT","VARCHAR(255)","TEXT","MEDIUMTEXT","LONGTEXT","CHAR(1)","BOOLEAN","FLOAT","DOUBLE","DECIMAL(10,2)","DATE","DATETIME","TIMESTAMP","JSON","BLOB","UUID"];

const DEFAULT_PRESETS: Record<string, string[]> = {
  serial: [], bigserial: [], smallserial: [],
  uuid: ["gen_random_uuid()", "uuid_generate_v4()", ""],
  boolean: ["true", "false", ""],
  timestamp: ["now()", "CURRENT_TIMESTAMP", ""],
  timestamptz: ["now()", "CURRENT_TIMESTAMP", ""],
  datetime: ["CURRENT_TIMESTAMP", ""],
  integer: ["0", "1", ""], bigint: ["0", ""], smallint: ["0", ""], int: ["0", ""],
  float: ["0", ""], "double precision": ["0", ""], real: ["0", ""],
  "numeric(10,2)": ["0", ""], "decimal(10,2)": ["0", ""],
  text: ["''", ""], "varchar(255)": ["''", ""], "char(1)": ["''", ""],
  json: ["'{}'", "'[]'", ""], jsonb: ["'{}'", "'[]'", ""],
  date: ["CURRENT_DATE", ""],
};

function uid(): string { return Math.random().toString(36).slice(2, 9); }
function dbTypes(): string[] { return (activeConn()?.type ?? "postgres") === "mysql" ? MY_TYPES : PG_TYPES; }
function q(s: string): string { return (activeConn()?.type ?? "postgres") === "mysql" ? `\`${s}\`` : `"${s}"`; }

// Per-tab mutable state (mirrors original module-level vars but scoped to active tab)
let _ddlMode: "schema" | "table" | "edit-table" | null = null;
let _ddlContext: { schema?: string; item?: SchemaItem | null; originalCols?: ColumnInfo[] } = {};
let _tblCols: TblCol[] = [];
let _tblIndexes: TblIndex[] = [];
let _tblFKeys: TblFKey[] = [];
let _tblTab: "columns" | "indexes" | "fkeys" = "columns";

export function openDdlModal(mode: "schema" | "table", context: { schema?: string } = {}): void {
  if (mode !== "schema") { openTableEditor(null, context); return; }
  _ddlMode = "schema";
  _ddlContext = context;
  el.ddlModal.hidden = false;
  el.ddlFormArea.textContent = "";
  el.ddlModalTitle.textContent = "New Schema";
  el.ddlGenerateBtn.textContent = "Create";
  el.ddlGenerateBtn.disabled = false;
  el.ddlModal.classList.remove("modal--tbl");
  el.ddlFormArea.appendChild(makeFormField("Schema name", "text", "my_schema", "ddlSchemaName"));
  requestAnimationFrame(() => (el.ddlFormArea.querySelector("input") as HTMLInputElement)?.focus());
}

export function closeDdlModal(): void {
  el.ddlModal.hidden = true;
  el.ddlModal.classList.remove("modal--tbl");
  el.ddlGenerateBtn.textContent = "Create";
  el.ddlGenerateBtn.disabled = false;
  _ddlMode = null; _ddlContext = {};
  _tblCols = []; _tblIndexes = []; _tblFKeys = [];
}

export function openTableEditor(item: SchemaItem | null, context: { schema?: string } = {}): void {
  const existingId = item
    ? S.tabs.find(t => t.kind === "table-editor" && t.tblItem?.name === item.name && t.tblItem?.parent === item.parent)?.id
    : null;
  if (existingId) { flushTabContent(); switchTab(existingId); return; }

  flushTabContent();
  const id = `tab-tbl-${Date.now()}`;
  S.tabs.push({
    id,
    kind: "table-editor",
    title: item ? item.name : "New Table",
    content: "",
    dbType: activeConn()?.type ?? "postgres",
    connId: S.activeConnId,
    tblItem: item ?? null,
    tblContext: context,
    tblCols: null,
    tblIndexes: [],
    tblFKeys: [],
    tblTab: "columns",
    originalCols: null,
    loaded: false,
  });
  S.activeTabId = id;
  save();
  renderTabs();
  syncEditorFromTab();
}

export async function mountTableEditorTab(tab: TableEditorTab): Promise<void> {
  const panel = el.tableEditorPanel;
  panel.textContent = "";

  _ddlMode    = tab.tblItem ? "edit-table" : "table";
  _ddlContext = { item: tab.tblItem, schema: tab.tblContext?.schema, originalCols: tab.originalCols ?? undefined };
  _tblCols    = tab.tblCols ?? [];
  _tblIndexes = tab.tblIndexes ?? [];
  _tblFKeys   = tab.tblFKeys ?? [];
  _tblTab     = tab.tblTab ?? "columns";

  const topBar = document.createElement("div");
  topBar.className = "tep-topbar";

  const dbType = activeConn()?.type ?? "postgres";
  if (dbType === "postgres" || dbType === "clickhouse") {
    const schemas = [...new Set(S.schemaItems.filter(i => i.type === "schema").map(i => i.name))];
    const sw = document.createElement("div"); sw.className = "tbl-hdr-field";
    const sl = document.createElement("label"); sl.textContent = "Schema";
    const ss = document.createElement("select"); ss.id = "tblSchemaInput";
    for (const s of schemas) {
      const o = document.createElement("option"); o.value = s; o.textContent = s;
      if (s === (tab.tblItem?.parent ?? tab.tblContext?.schema ?? "public")) o.selected = true;
      ss.appendChild(o);
    }
    sw.appendChild(sl); sw.appendChild(ss); topBar.appendChild(sw);
  }

  const nw = document.createElement("div"); nw.className = "tbl-hdr-field";
  const nl = document.createElement("label"); nl.textContent = "Table name";
  const ni = document.createElement("input") as HTMLInputElement;
  ni.id = "tblNameInput"; ni.placeholder = "new_table"; ni.autocomplete = "off";
  ni.value = tab.tblItem?.name ?? "";
  ni.addEventListener("input", () => { tab.title = ni.value || "New Table"; renderTabs(); });
  nw.appendChild(nl); nw.appendChild(ni); topBar.appendChild(nw);

  const spacer = document.createElement("div"); spacer.style.flex = "1";
  topBar.appendChild(spacer);

  const applyBtn = document.createElement("button") as HTMLButtonElement;
  applyBtn.className = "btn btn-primary tep-apply-btn";
  applyBtn.textContent = tab.tblItem ? "Apply changes" : "Create table";
  applyBtn.addEventListener("click", async () => {
    _tblCols = tab.tblCols ?? _tblCols;
    _tblIndexes = tab.tblIndexes ?? _tblIndexes;
    _tblFKeys = tab.tblFKeys ?? _tblFKeys;
    const sql = _ddlMode === "edit-table" ? generateAlterSql() : generateDdlSql();
    if (!sql) { alert(_ddlMode === "edit-table" ? "No changes detected." : "Fill in table name and at least one column."); return; }
    applyBtn.disabled = true; applyBtn.textContent = "Executing…";
    try { await executeDdl(sql); closeTab(tab.id); }
    finally { applyBtn.disabled = false; applyBtn.textContent = tab.tblItem ? "Apply changes" : "Create table"; }
  });
  topBar.appendChild(applyBtn);
  panel.appendChild(topBar);

  const tabBar = document.createElement("div");
  tabBar.className = "tbl-tabs";
  for (const [key, label] of [["columns","Columns"],["indexes","Indexes"],["fkeys","Foreign Keys"]] as const) {
    const btn = document.createElement("button");
    btn.className = "tbl-tab" + (key === _tblTab ? " active" : "");
    btn.textContent = label; btn.dataset.tab = key;
    btn.addEventListener("click", () => {
      tabBar.querySelectorAll(".tbl-tab").forEach(b => b.classList.toggle("active", b === btn));
      _tblTab = key; tab.tblTab = key; renderTblGrid();
    });
    tabBar.appendChild(btn);
  }
  panel.appendChild(tabBar);

  const gridWrap = document.createElement("div");
  gridWrap.id = "tblGrid"; gridWrap.className = "tbl-grid-wrap";
  panel.appendChild(gridWrap);

  const toolbar = document.createElement("div");
  toolbar.className = "tbl-toolbar";
  const addRowBtn = document.createElement("button");
  addRowBtn.className = "tbl-toolbar-btn"; addRowBtn.id = "tblAddRowBtn";
  addRowBtn.textContent = "+ Add row";
  addRowBtn.addEventListener("click", () => {
    if (_tblTab === "columns") {
      _tblCols.push({ id: uid(), name: "", type: dbTypes()[0], notNull: false, pk: false, unique: false, default: "", original: null });
      tab.tblCols = _tblCols;
    } else if (_tblTab === "indexes") {
      _tblIndexes.push({ id: uid(), name: "", columns: "", unique: false });
      tab.tblIndexes = _tblIndexes;
    } else {
      _tblFKeys.push({ id: uid(), column: _tblCols[0]?.name ?? "", refTable: "", refColumn: "id", onDelete: "NO ACTION" });
      tab.tblFKeys = _tblFKeys;
    }
    renderTblGrid();
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll("#tblGrid .tg-input");
      (inputs[inputs.length - 1] as HTMLInputElement)?.focus();
    });
  });
  toolbar.appendChild(addRowBtn);
  panel.appendChild(toolbar);

  if (tab.tblItem && !tab.loaded) {
    const loadEl = document.createElement("div");
    loadEl.className = "tbl-loading"; loadEl.textContent = "Loading columns…";
    gridWrap.appendChild(loadEl);
    try {
      const conn = activeConn()!;
      const data = await apiColumns(tab.tblItem.parent, tab.tblItem.name);
      const cols = data.columns as ColumnInfo[];
      _tblCols = cols.map(c => ({
        id: uid(), name: c.name, type: c.dataType,
        notNull: !c.nullable, pk: c.isPrimary, unique: false, default: "", original: c.name,
      }));
      _ddlContext.originalCols = cols.map(c => ({ ...c }));
      tab.tblCols = _tblCols;
      tab.originalCols = _ddlContext.originalCols;
      tab.loaded = true;
    } catch (err) {
      gridWrap.textContent = "";
      const errEl = document.createElement("div");
      errEl.style.cssText = "padding:20px;color:var(--red);font-size:12px;";
      errEl.textContent = `Error: ${(err as Error).message}`;
      gridWrap.appendChild(errEl);
      return;
    }
  } else if (!tab.tblItem && !tab.loaded) {
    _tblCols = [
      { id: uid(), name: "id", type: "serial", notNull: true, pk: true, unique: false, default: "", original: null },
      { id: uid(), name: "created_at", type: "timestamptz", notNull: true, pk: false, unique: false, default: "now()", original: null },
    ];
    tab.tblCols = _tblCols;
    tab.loaded = true;
  }

  renderTblGrid();
  requestAnimationFrame(() => (document.querySelector("#tblGrid .tg-input") as HTMLInputElement)?.focus());
}

function syncTblToTab(): void {
  const tab = S.tabs.find(t => t.id === S.activeTabId);
  if (!tab || tab.kind !== "table-editor") return;
  tab.tblCols = _tblCols;
  tab.tblIndexes = _tblIndexes;
  tab.tblFKeys = _tblFKeys;
  tab.tblTab = _tblTab;
}

function pkOpts(): Array<{ v: number; label: string }> {
  const maxOrder = Math.max(0, ..._tblCols.map(c => c.pkOrder ?? 0));
  const opts = [{ v: 0, label: "—" }];
  for (let i = 1; i <= maxOrder + 1; i++) opts.push({ v: i, label: `PK ${i}` });
  return opts;
}

function renderTblGrid(): void {
  const wrap = document.getElementById("tblGrid");
  if (!wrap) return;
  wrap.textContent = "";

  if (_tblTab === "columns") {
    const grid = document.createElement("div");
    grid.className = "tbl-grid";
    grid.style.gridTemplateColumns = "52px 1fr 160px 36px 36px minmax(120px, 220px) 28px";

    for (const lbl of ["PK", "Name", "Type", "NN", "UQ", "Default", ""]) {
      const th = document.createElement("div"); th.className = "tg-head"; th.textContent = lbl; grid.appendChild(th);
    }

    for (const row of _tblCols) {
      const isPk = (row.pkOrder ?? 0) > 0;

      const pkCell = document.createElement("div");
      pkCell.className = "tg-cell" + (isPk ? " tg-pk-row" : "");
      const pkSel = document.createElement("select") as HTMLSelectElement;
      pkSel.className = "tg-select tg-pk-sel";
      for (const o of pkOpts()) {
        const opt = document.createElement("option");
        opt.value = String(o.v); opt.textContent = o.label;
        if (o.v === (row.pkOrder ?? 0)) opt.selected = true;
        pkSel.appendChild(opt);
      }
      pkSel.addEventListener("change", () => {
        const r = _tblCols.find(r => r.id === row.id); if (!r) return;
        r.pkOrder = Number(pkSel.value); r.pk = r.pkOrder > 0;
        if (r.pk) r.notNull = true;
        syncTblToTab(); renderTblGrid();
      });
      pkCell.appendChild(pkSel); grid.appendChild(pkCell);

      const nameCell = makeTgCell(isPk);
      const nameInp = document.createElement("input") as HTMLInputElement;
      nameInp.className = "tg-input"; nameInp.value = row.name ?? ""; nameInp.placeholder = "column_name";
      nameInp.addEventListener("input", () => { const r = _tblCols.find(r => r.id === row.id); if (r) r.name = nameInp.value; syncTblToTab(); });
      nameInp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("tblAddRowBtn")?.click(); } });
      nameCell.appendChild(nameInp); grid.appendChild(nameCell);

      const typeCell = makeTgCell(isPk);
      const typeSel = document.createElement("select") as HTMLSelectElement;
      typeSel.className = "tg-select";
      for (const t of dbTypes()) {
        const opt = document.createElement("option"); opt.value = t; opt.textContent = t;
        if (t === row.type) opt.selected = true; typeSel.appendChild(opt);
      }
      typeSel.addEventListener("change", () => {
        const r = _tblCols.find(r => r.id === row.id); if (!r) return;
        r.type = typeSel.value; r.default = "";
        syncTblToTab(); renderTblGrid();
      });
      typeCell.appendChild(typeSel); grid.appendChild(typeCell);

      const nnCell = makeTgCell(isPk, "center");
      const nnChk = document.createElement("input") as HTMLInputElement;
      nnChk.type = "checkbox"; nnChk.className = "tg-checkbox"; nnChk.checked = !!row.notNull;
      if (isPk) { nnChk.disabled = true; nnChk.title = "NOT NULL implied by PK"; }
      nnChk.addEventListener("change", () => { const r = _tblCols.find(r => r.id === row.id); if (r) { r.notNull = nnChk.checked; syncTblToTab(); } });
      nnCell.appendChild(nnChk); grid.appendChild(nnCell);

      const uqCell = makeTgCell(isPk, "center");
      const uqChk = document.createElement("input") as HTMLInputElement;
      uqChk.type = "checkbox"; uqChk.className = "tg-checkbox"; uqChk.checked = !!row.unique;
      uqChk.addEventListener("change", () => { const r = _tblCols.find(r => r.id === row.id); if (r) { r.unique = uqChk.checked; syncTblToTab(); } });
      uqCell.appendChild(uqChk); grid.appendChild(uqCell);

      const dfCell = makeTgCell(isPk);
      const typeKey = (row.type ?? "").toLowerCase();
      const presets = DEFAULT_PRESETS[typeKey] ?? [""];
      const isAutoType = ["serial","bigserial","smallserial"].includes(typeKey);

      if (isAutoType) {
        const tag = document.createElement("span");
        tag.className = "tg-auto-tag"; tag.textContent = "auto";
        dfCell.appendChild(tag);
      } else {
        const dfWrap = document.createElement("div");
        dfWrap.className = "tg-default-wrap";

        if (presets.length > 1) {
          const dfSel = document.createElement("select") as HTMLSelectElement;
          dfSel.className = "tg-select tg-default-sel";
          const manualOpt = document.createElement("option");
          manualOpt.value = "__custom__"; manualOpt.textContent = "custom…";
          dfSel.appendChild(manualOpt);
          for (const p of presets) {
            const opt = document.createElement("option");
            opt.value = p; opt.textContent = p === "" ? "none" : p;
            if (p === (row.default ?? "")) opt.selected = true;
            dfSel.appendChild(opt);
          }
          if (!presets.includes(row.default ?? "")) manualOpt.selected = true;

          const dfInp = document.createElement("input") as HTMLInputElement;
          dfInp.className = "tg-input tg-default-inp"; dfInp.value = row.default ?? "";
          dfInp.placeholder = "expression"; dfInp.hidden = dfSel.value !== "__custom__";
          dfInp.addEventListener("input", () => { const r = _tblCols.find(r => r.id === row.id); if (r) { r.default = dfInp.value; syncTblToTab(); } });
          dfSel.addEventListener("change", () => {
            if (dfSel.value === "__custom__") { dfInp.hidden = false; dfInp.focus(); }
            else { dfInp.hidden = true; const r = _tblCols.find(r => r.id === row.id); if (r) { r.default = dfSel.value; syncTblToTab(); } }
          });
          dfWrap.appendChild(dfSel); dfWrap.appendChild(dfInp);
        } else {
          const dfInp = document.createElement("input") as HTMLInputElement;
          dfInp.className = "tg-input"; dfInp.value = row.default ?? ""; dfInp.placeholder = "default value";
          dfInp.addEventListener("input", () => { const r = _tblCols.find(r => r.id === row.id); if (r) { r.default = dfInp.value; syncTblToTab(); } });
          dfWrap.appendChild(dfInp);
        }
        dfCell.appendChild(dfWrap);
      }
      grid.appendChild(dfCell);

      const delCell = makeTgCell(isPk);
      const delBtn = document.createElement("button");
      delBtn.className = "tg-del-btn"; delBtn.textContent = "×"; delBtn.title = "Remove column";
      delBtn.addEventListener("click", () => { _tblCols = _tblCols.filter(r => r.id !== row.id); syncTblToTab(); renderTblGrid(); });
      delCell.appendChild(delBtn); grid.appendChild(delCell);
    }

    if (!_tblCols.length) {
      const empty = document.createElement("div");
      empty.className = "tg-empty"; empty.style.gridColumn = "1 / -1";
      empty.textContent = 'No columns — click "+ Add row" below';
      grid.appendChild(empty);
    }
    wrap.appendChild(grid);

  } else if (_tblTab === "indexes") {
    renderGrid(wrap,
      [
        { key: "name",    label: "Index name",               w: "1fr",  type: "text" },
        { key: "columns", label: "Columns (comma-separated)", w: "1fr",  type: "combo", opts: _tblCols.map(c => c.name).filter(Boolean) },
        { key: "unique",  label: "Unique",                   w: "52px", type: "check" },
        { key: "_del",    label: "",                          w: "28px", type: "del" },
      ],
      _tblIndexes,
      (id, key, val) => { const r = _tblIndexes.find(r => r.id === id); if (r) { (r as Record<string, unknown>)[key] = val; syncTblToTab(); } },
      id => { _tblIndexes = _tblIndexes.filter(r => r.id !== id); syncTblToTab(); renderTblGrid(); }
    );
  } else {
    const allTables = S.schemaItems.filter(i => i.type === "table").map(i => i.name);
    renderGrid(wrap,
      [
        { key: "column",    label: "Column",    w: "1fr",   type: "select", opts: _tblCols.map(c => c.name).filter(Boolean) },
        { key: "refTable",  label: "Ref table", w: "1fr",   type: "combo",  opts: allTables },
        { key: "refColumn", label: "Ref col",   w: "110px", type: "text" },
        { key: "onDelete",  label: "On delete", w: "120px", type: "select", opts: ["NO ACTION","CASCADE","SET NULL","RESTRICT","SET DEFAULT"] },
        { key: "_del",      label: "",          w: "28px",  type: "del" },
      ],
      _tblFKeys,
      (id, key, val) => { const r = _tblFKeys.find(r => r.id === id); if (r) { (r as Record<string, unknown>)[key] = val; syncTblToTab(); } },
      id => { _tblFKeys = _tblFKeys.filter(r => r.id !== id); syncTblToTab(); renderTblGrid(); }
    );
  }
}

type ColDef = { key: string; label: string; w: string; type: "text" | "check" | "select" | "combo" | "del"; opts?: string[] };

function renderGrid(wrap: HTMLElement, coldefs: ColDef[], rows: Array<Record<string, unknown>>, onChange: (id: string, key: string, val: unknown) => void, onDelete: (id: string) => void): void {
  const grid = document.createElement("div");
  grid.className = "tbl-grid";
  grid.style.gridTemplateColumns = coldefs.map(c => c.w).join(" ");

  for (const col of coldefs) {
    const th = document.createElement("div"); th.className = "tg-head"; th.textContent = col.label; grid.appendChild(th);
  }

  for (const row of rows) {
    for (const col of coldefs) {
      const cell = document.createElement("div"); cell.className = "tg-cell"; cell.dataset.col = col.key;
      if (col.type === "del") {
        const btn = document.createElement("button");
        btn.className = "tg-del-btn"; btn.textContent = "×";
        btn.addEventListener("click", () => onDelete(row.id as string));
        cell.appendChild(btn);
      } else if (col.type === "check") {
        cell.style.justifyContent = "center";
        const chk = document.createElement("input") as HTMLInputElement;
        chk.type = "checkbox"; chk.className = "tg-checkbox"; chk.checked = !!row[col.key];
        chk.addEventListener("change", () => onChange(row.id as string, col.key, chk.checked));
        cell.appendChild(chk);
      } else if (col.type === "select") {
        const sel = document.createElement("select") as HTMLSelectElement; sel.className = "tg-select";
        for (const o of (col.opts ?? [])) {
          const opt = document.createElement("option"); opt.value = o; opt.textContent = o;
          if (o === row[col.key]) opt.selected = true; sel.appendChild(opt);
        }
        sel.addEventListener("change", () => onChange(row.id as string, col.key, sel.value));
        cell.appendChild(sel);
      } else if (col.type === "combo") {
        const inp = document.createElement("input") as HTMLInputElement; inp.className = "tg-input"; inp.value = (row[col.key] as string) ?? "";
        const dlId = "tg-dl-" + col.key; inp.setAttribute("list", dlId);
        const dl = document.createElement("datalist"); dl.id = dlId;
        for (const o of (col.opts ?? [])) { const opt = document.createElement("option"); opt.value = o; dl.appendChild(opt); }
        inp.addEventListener("input", () => onChange(row.id as string, col.key, inp.value));
        cell.appendChild(inp); cell.appendChild(dl);
      } else {
        const inp = document.createElement("input") as HTMLInputElement; inp.className = "tg-input"; inp.value = (row[col.key] as string) ?? ""; inp.placeholder = col.label;
        inp.addEventListener("input", () => onChange(row.id as string, col.key, inp.value));
        inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("tblAddRowBtn")?.click(); } });
        cell.appendChild(inp);
      }
      grid.appendChild(cell);
    }
  }

  if (!rows.length) {
    const empty = document.createElement("div"); empty.className = "tg-empty"; empty.style.gridColumn = "1 / -1";
    empty.textContent = 'No rows — click "+ Add row" below'; grid.appendChild(empty);
  }
  wrap.appendChild(grid);
}

function makeTgCell(isPk: boolean, justify = ""): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "tg-cell" + (isPk ? " tg-pk-row" : "");
  if (justify) cell.style.justifyContent = justify;
  return cell;
}

function colSql(c: TblCol, pkCount: number, dbType: string): string {
  const autoTypes = new Set(["serial","bigserial","smallserial"]);
  const nn = c.notNull && !autoTypes.has((c.type ?? "").toLowerCase()) ? " NOT NULL" : "";
  const uq = c.unique && !c.pk ? " UNIQUE" : "";
  const df = c.default && !autoTypes.has((c.type ?? "").toLowerCase()) ? ` DEFAULT ${c.default}` : "";
  const pk = c.pk && pkCount === 1 ? " PRIMARY KEY" : "";
  return dbType === "mysql"
    ? `  \`${c.name}\` ${c.type}${nn}${uq}${df}${pk}`
    : `  ${q(c.name)} ${c.type}${nn}${uq}${df}${pk}`;
}

export function generateDdlSql(): string | null {
  if (_ddlMode === "schema") {
    const name = (document.getElementById("ddlSchemaName") as HTMLInputElement)?.value.trim();
    if (!name) return null;
    return (activeConn()?.type ?? "postgres") === "mysql"
      ? `CREATE DATABASE IF NOT EXISTS \`${name}\`;`
      : `CREATE SCHEMA IF NOT EXISTS ${q(name)};`;
  }

  if (_ddlMode === "table") {
    const schema = (document.getElementById("tblSchemaInput") as HTMLSelectElement)?.value;
    const name = (document.getElementById("tblNameInput") as HTMLInputElement)?.value.trim();
    if (!name) return null;
    const cols = _tblCols.filter(c => c.name);
    if (!cols.length) return null;

    const dbType = activeConn()?.type ?? "postgres";
    const pkCols = cols.filter(c => c.pk).sort((a, b) => (a.pkOrder ?? 1) - (b.pkOrder ?? 1));
    const colDefs = cols.map(c => colSql(c, pkCols.length, dbType));

    if (pkCols.length > 1)
      colDefs.push(`  PRIMARY KEY (${pkCols.map(c => dbType === "mysql" ? `\`${c.name}\`` : q(c.name)).join(", ")})`);

    for (const fk of _tblFKeys.filter(f => f.column && f.refTable))
      colDefs.push(`  FOREIGN KEY (${q(fk.column)}) REFERENCES ${q(fk.refTable)} (${q(fk.refColumn || "id")}) ON DELETE ${fk.onDelete}`);

    const ref = schema ? `${q(schema)}.${q(name)}` : q(name);
    let sql = `CREATE TABLE IF NOT EXISTS ${ref} (\n${colDefs.join(",\n")}\n);`;

    for (const idx of _tblIndexes.filter(i => i.columns)) {
      const uq = idx.unique ? "UNIQUE " : "";
      const idxName = idx.name || `idx_${name}_${idx.columns.replace(/,\s*/g, "_")}`;
      const idxCols = idx.columns.split(",").map(c => q(c.trim())).join(", ");
      sql += `\nCREATE ${uq}INDEX ${q(idxName)} ON ${ref} (${idxCols});`;
    }
    return sql;
  }
  return null;
}

export function generateAlterSql(): string | null {
  const item = _ddlContext?.item;
  if (!item) return null;
  const schema = (document.getElementById("tblSchemaInput") as HTMLSelectElement)?.value ?? item.parent;
  const newName = (document.getElementById("tblNameInput") as HTMLInputElement)?.value.trim();
  const tableRef = schema ? `${q(schema)}.${q(item.name)}` : q(item.name);
  const effectiveName = newName || item.name;
  const effectiveRef = schema ? `${q(schema)}.${q(effectiveName)}` : q(effectiveName);
  const dbType = activeConn()?.type ?? "postgres";
  const stmts: string[] = [];

  if (newName && newName !== item.name)
    stmts.push(dbType === "mysql"
      ? `RENAME TABLE ${tableRef} TO ${q(newName)};`
      : `ALTER TABLE ${tableRef} RENAME TO ${q(newName)};`);

  const currentOriginals = new Set(_tblCols.map(c => c.original).filter(Boolean));

  for (const orig of (_ddlContext.originalCols ?? []))
    if (!currentOriginals.has(orig.name))
      stmts.push(`ALTER TABLE ${effectiveRef} DROP COLUMN ${q(orig.name)};`);

  for (const col of _tblCols.filter(c => c.name)) {
    if (!col.original) {
      const autoTypes = new Set(["serial","bigserial","smallserial"]);
      const nn = col.notNull && !autoTypes.has((col.type ?? "").toLowerCase()) ? " NOT NULL" : "";
      const df = col.default && !autoTypes.has((col.type ?? "").toLowerCase()) ? ` DEFAULT ${col.default}` : "";
      stmts.push(`ALTER TABLE ${effectiveRef} ADD COLUMN ${q(col.name)} ${col.type}${nn}${df};`);
    } else if (col.original !== col.name) {
      stmts.push(`ALTER TABLE ${effectiveRef} RENAME COLUMN ${q(col.original)} TO ${q(col.name)};`);
    }
  }

  for (const idx of _tblIndexes.filter(i => i.columns)) {
    const uq = idx.unique ? "UNIQUE " : "";
    const idxName = idx.name || `idx_${effectiveName}_${idx.columns.replace(/,\s*/g, "_")}`;
    const idxCols = idx.columns.split(",").map(c => q(c.trim())).join(", ");
    stmts.push(`CREATE ${uq}INDEX ${q(idxName)} ON ${effectiveRef} (${idxCols});`);
  }

  for (const fk of _tblFKeys.filter(f => f.column && f.refTable)) {
    const cn = `fk_${effectiveName}_${fk.column}`;
    stmts.push(`ALTER TABLE ${effectiveRef} ADD CONSTRAINT ${q(cn)} FOREIGN KEY (${q(fk.column)}) REFERENCES ${q(fk.refTable)} (${q(fk.refColumn || "id")}) ON DELETE ${fk.onDelete};`);
  }

  return stmts.length ? stmts.join("\n") : null;
}

function makeFormField(label: string, type: string, placeholder: string, id: string, options: string[] = []): HTMLElement {
  const wrap = document.createElement("div"); wrap.className = "form-field";
  const lbl = document.createElement("label"); lbl.textContent = label; lbl.htmlFor = id;
  wrap.appendChild(lbl);
  if (type === "select") {
    const sel = document.createElement("select"); sel.id = id;
    for (const o of options) { const opt = document.createElement("option"); opt.value = o; opt.textContent = o; sel.appendChild(opt); }
    wrap.appendChild(sel);
  } else {
    const inp = document.createElement("input") as HTMLInputElement;
    inp.type = type; inp.id = id; inp.placeholder = placeholder; inp.autocomplete = "off";
    wrap.appendChild(inp);
  }
  return wrap;
}

export function initDdlModal(): void {
  el.ddlModalClose.addEventListener("click", closeDdlModal);
  el.ddlCancelBtn.addEventListener("click", closeDdlModal);
  el.ddlModal.addEventListener("click", e => { if (e.target === el.ddlModal) closeDdlModal(); });
  el.ddlGenerateBtn.addEventListener("click", async () => {
    const isEdit = _ddlMode === "edit-table";
    const sql = isEdit ? generateAlterSql() : generateDdlSql();
    if (!sql) { alert(isEdit ? "No changes detected." : "Please fill in required fields."); return; }
    el.ddlGenerateBtn.disabled = true;
    el.ddlGenerateBtn.textContent = isEdit ? "Applying…" : "Creating…";
    try { await executeDdl(sql); closeDdlModal(); }
    finally { el.ddlGenerateBtn.disabled = false; el.ddlGenerateBtn.textContent = isEdit ? "Apply" : "Create"; }
  });
}
