import { el } from "./dom";
import { S, activeConn } from "../data/state";
import { setStatus } from "./status";
import { apiSchema, apiColumns, buildConnPayload } from "../data/api";
import { makeSvgIcon, svgEl } from "./svg";
import { openDdlModal } from "./ddl";
import { openErdTab } from "./erd";
import { openTableEditor } from "./ddl";
import type { SchemaItem, ColumnInfo } from "../core/types";

export const OBJECT_ORDER = ["table", "view", "matview", "function", "sequence", "trigger", "index", "collection"] as const;
export const OBJECT_LABELS: Record<string, string> = {
  table: "Tables", view: "Views", matview: "Mat. Views", function: "Functions",
  sequence: "Sequences", trigger: "Triggers", index: "Indexes", collection: "Collections",
};
const SYSTEM_SCHEMAS = new Set(["pg_catalog", "information_schema", "pg_toast"]);

export async function loadSchema(): Promise<void> {
  const conn = activeConn();
  if (!conn) return;
  S.columnCache.clear();
  setStatus("loading", "Loading schema…");
  try {
    const data = await apiSchema();
    S.schemaItems = (data.items as SchemaItem[]) ?? [];
    renderSchemaTree();
    setStatus("ok", `${conn.name} — ${S.schemaItems.filter(i => i.type !== "schema").length} tables`);
  } catch (err) {
    setStatus("error", `Schema: ${(err as Error).message}`);
    const errEl = document.createElement("div");
    errEl.className = "empty-state";
    errEl.style.color = "var(--red)";
    errEl.textContent = (err as Error).message;
    el.schemaTree.textContent = "";
    el.schemaTree.appendChild(errEl);
  }
}

export function renderSchemaTree(): void {
  el.schemaTree.textContent = "";
  const filter = el.schemaSearch.value.trim().toLowerCase();

  const items = filter
    ? S.schemaItems.filter(i => `${i.parent ?? ""}.${i.name}`.toLowerCase().includes(filter))
    : S.schemaItems;

  if (!items.length) {
    const msg = document.createElement("div");
    msg.className = "empty-state";
    msg.textContent = S.schemaItems.length ? "No objects match filter." : "Select a connection to explore its schema.";
    el.schemaTree.appendChild(msg);
    return;
  }

  const bySchema = new Map<string, Map<string, SchemaItem[]>>();
  const noSchema = new Map<string, SchemaItem[]>();

  for (const item of items) {
    if (item.type === "schema") continue;
    if (item.parent) {
      if (!bySchema.has(item.parent)) bySchema.set(item.parent, new Map());
      const typeMap = bySchema.get(item.parent)!;
      if (!typeMap.has(item.type)) typeMap.set(item.type, []);
      typeMap.get(item.type)!.push(item);
    } else {
      if (!noSchema.has(item.type)) noSchema.set(item.type, []);
      noSchema.get(item.type)!.push(item);
    }
  }

  const schemas = items.filter(i => i.type === "schema");
  for (const schema of schemas) {
    const typeMap = bySchema.get(schema.name) ?? new Map();
    el.schemaTree.appendChild(makeSchemaGroup(schema.name, typeMap));
  }

  if (!schemas.length) {
    for (const [type, list] of noSchema) {
      el.schemaTree.appendChild(makeTypeGroup(OBJECT_LABELS[type] ?? type, list));
    }
  }
}

function makeSchemaGroup(schemaName: string, typeMap: Map<string, SchemaItem[]>): HTMLElement {
  const group = document.createElement("div");
  group.className = "tree-group";
  const isSystem = SYSTEM_SCHEMAS.has(schemaName);

  const hdr = document.createElement("div");
  hdr.className = "tree-schema-hdr" + (isSystem ? " tree-schema-system" : "");
  hdr.setAttribute("role", "button");
  hdr.tabIndex = 0;

  const chev = document.createElement("span");
  chev.className = "tree-chevron" + (isSystem ? "" : " open");
  chev.setAttribute("aria-hidden", "true");
  const chevSvg = makeSvgIcon("9","9",[svgEl("polyline",{points:"9 18 15 12 9 6"})]);
  chevSvg.setAttribute("stroke-width","2.5");
  chev.appendChild(chevSvg);

  const schemaIcon = document.createElement("span");
  schemaIcon.className = "tree-schema-icon";
  schemaIcon.appendChild(makeSvgIcon("12","12",[
    svgEl("path",{d:"M3 6c0-1.1 3.58-2 8-2s8 .9 8 2v2c0 1.1-3.58 2-8 2s-8-.9-8-2V6z"}),
    svgEl("path",{d:"M3 12c0 1.1 3.58 2 8 2s8-.9 8-2"}),
    svgEl("path",{d:"M3 6v6"}),svgEl("path",{d:"M19 6v6"}),
  ]));

  const nameEl = document.createElement("span");
  nameEl.className = "tree-schema-name";
  nameEl.textContent = schemaName;

  let totalObjects = 0;
  for (const [,list] of typeMap) totalObjects += list.length;
  const badge = document.createElement("span");
  badge.className = "tree-schema-badge";
  badge.textContent = totalObjects ? String(totalObjects) : "";

  const actions = document.createElement("span");
  actions.className = "tree-hdr-actions";

  const addTableBtn = document.createElement("button");
  addTableBtn.className = "tree-hdr-btn";
  addTableBtn.title = "New table";
  addTableBtn.appendChild(makeSvgIcon("11","11",[svgEl("line",{x1:"12",y1:"5",x2:"12",y2:"19"}),svgEl("line",{x1:"5",y1:"12",x2:"19",y2:"12"})]));
  addTableBtn.addEventListener("click", e => { e.stopPropagation(); openDdlModal("table", { schema: schemaName }); });

  const erdBtn = document.createElement("button");
  erdBtn.className = "tree-erd-btn";
  erdBtn.title = "Open ERD diagram";
  erdBtn.appendChild(makeSvgIcon("12","12",[
    svgEl("rect",{x:"1",y:"1",width:"8",height:"6",rx:"1.5"}),
    svgEl("rect",{x:"15",y:"1",width:"8",height:"6",rx:"1.5"}),
    svgEl("rect",{x:"1",y:"15",width:"8",height:"6",rx:"1.5"}),
    svgEl("line",{x1:"9",y1:"4",x2:"15",y2:"4"}),
    svgEl("line",{x1:"5",y1:"7",x2:"5",y2:"18"}),
    svgEl("line",{x1:"5",y1:"18",x2:"9",y2:"18"}),
  ]));
  erdBtn.addEventListener("click", e => { e.stopPropagation(); openErdTab(schemaName); });

  const moreBtn = document.createElement("button");
  moreBtn.className = "tree-hdr-btn";
  moreBtn.title = "More options";
  moreBtn.appendChild(makeSvgIcon("11","11",[
    svgEl("circle",{cx:"12",cy:"5",r:"1"}),svgEl("circle",{cx:"12",cy:"12",r:"1"}),svgEl("circle",{cx:"12",cy:"19",r:"1"}),
  ]));
  moreBtn.addEventListener("click", e => {
    e.stopPropagation();
    import("./contextmenu").then(m => m.showCtxMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, { type: "schema" as const, item: { name: schemaName, type: "schema" as const } }));
  });

  actions.appendChild(addTableBtn);
  actions.appendChild(moreBtn);

  hdr.appendChild(chev);
  hdr.appendChild(schemaIcon);
  hdr.appendChild(nameEl);
  hdr.appendChild(badge);
  if (!isSystem) hdr.appendChild(erdBtn);
  hdr.appendChild(actions);

  const children = document.createElement("div");
  children.className = "tree-children" + (isSystem ? "" : " open");

  const allItems: SchemaItem[] = [];
  for (const type of OBJECT_ORDER) {
    for (const item of (typeMap.get(type) ?? [])) allItems.push(item);
  }

  if (allItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tree-empty-schema";
    empty.textContent = "Empty schema";
    children.appendChild(empty);
  } else {
    for (const item of allItems) children.appendChild(makeTableNode(item));
  }

  const toggle = () => {
    const open = children.classList.toggle("open");
    chev.classList.toggle("open", open);
  };
  hdr.addEventListener("click", toggle);
  hdr.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });
  hdr.addEventListener("contextmenu", e => {
    e.preventDefault();
    import("./contextmenu").then(m => m.showCtxMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, { type: "schema" as const, item: { name: schemaName, type: "schema" as const } }));
  });

  group.appendChild(hdr);
  group.appendChild(children);
  return group;
}

function makeTypeGroup(label: string, items: SchemaItem[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "tree-group";
  for (const item of items) group.appendChild(makeTableNode(item));
  return group;
}

const NODE_ICONS: Record<string, () => SVGElement> = {
  table: () => makeSvgIcon("12","12",[svgEl("rect",{x:"3",y:"3",width:"18",height:"18",rx:"2"}),svgEl("line",{x1:"3",y1:"9",x2:"21",y2:"9"}),svgEl("line",{x1:"3",y1:"15",x2:"21",y2:"15"}),svgEl("line",{x1:"9",y1:"3",x2:"9",y2:"21"})]),
  view: () => makeSvgIcon("12","12",[svgEl("path",{d:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"}),svgEl("circle",{cx:"12",cy:"12",r:"3"})]),
  matview: () => makeSvgIcon("12","12",[svgEl("path",{d:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"}),svgEl("circle",{cx:"12",cy:"12",r:"3"}),svgEl("line",{x1:"20",y1:"4",x2:"20",y2:"8"}),svgEl("line",{x1:"18",y1:"6",x2:"22",y2:"6"})]),
  function: () => makeSvgIcon("12","12",[svgEl("polyline",{points:"4 17 10 11 4 5"}),svgEl("line",{x1:"12",y1:"19",x2:"20",y2:"19"})]),
  sequence: () => makeSvgIcon("12","12",[svgEl("line",{x1:"4",y1:"6",x2:"20",y2:"6"}),svgEl("line",{x1:"4",y1:"12",x2:"20",y2:"12"}),svgEl("line",{x1:"4",y1:"18",x2:"20",y2:"18"}),svgEl("polyline",{points:"16 2 20 6 16 10"})]),
  trigger: () => makeSvgIcon("12","12",[svgEl("polygon",{points:"13 2 3 14 12 14 11 22 21 10 12 10 13 2"})]),
  index: () => makeSvgIcon("12","12",[svgEl("line",{x1:"4",y1:"9",x2:"20",y2:"9"}),svgEl("line",{x1:"4",y1:"15",x2:"20",y2:"15"}),svgEl("polyline",{points:"10 3 4 9 10 15"})]),
  collection: () => makeSvgIcon("12","12",[svgEl("ellipse",{cx:"12",cy:"6",rx:"9",ry:"3.5"}),svgEl("path",{d:"M3 6v5c0 1.93 4.03 3.5 9 3.5s9-1.57 9-3.5V6"}),svgEl("path",{d:"M3 11v5c0 1.93 4.03 3.5 9 3.5s9-1.57 9-3.5v-5"})]),
};

function makeTableNode(item: SchemaItem): HTMLElement {
  const isExpandable = item.type === "table" || item.type === "view";
  const wrapper = document.createElement("div");
  wrapper.className = "tree-table-wrapper";

  const row = document.createElement("div");
  row.className = "tree-table-row";

  let chevron: HTMLElement | null = null;
  if (isExpandable) {
    chevron = document.createElement("span");
    chevron.className = "tree-chevron tree-col-chevron";
    chevron.setAttribute("aria-hidden", "true");
    const chevSvg = makeSvgIcon("9","9",[svgEl("polyline",{points:"9 18 15 12 9 6"})]);
    chevSvg.setAttribute("stroke-width","2.5");
    chevron.appendChild(chevSvg);
    row.appendChild(chevron);
  }

  const btn = document.createElement("button");
  btn.className = "tree-table-node";
  btn.title = item.parent ? `${item.parent}.${item.name}` : item.name;

  const icon = document.createElement("span");
  icon.className = `tree-node-icon tree-node-icon--${item.type ?? "table"}`;
  icon.setAttribute("aria-hidden", "true");
  icon.appendChild((NODE_ICONS[item.type] ?? NODE_ICONS.table)());

  const name = document.createElement("span");
  name.textContent = item.name;
  name.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;";

  btn.appendChild(icon);
  btn.appendChild(name);

  if (item.type !== "table" && item.type !== "collection") {
    const typeBadge = document.createElement("span");
    typeBadge.className = "tree-node-type-badge";
    const BADGE: Record<string, string> = { view: "V", matview: "MV", function: "fn", index: "idx", sequence: "seq", trigger: "trg" };
    typeBadge.textContent = BADGE[item.type] ?? item.type[0];
    btn.appendChild(typeBadge);
  }

  btn.addEventListener("click", () => {
    import("./query").then(m => {
      el.editor.value = m.makeQueryTemplate(item);
      import("./tabs").then(t => { t.flushTabContent(); import("../data/persistence").then(p => p.save()); });
      import("./editor").then(e => { e.updateGutter(); e.updateHighlight(); });
      el.editor.focus();
    });
  });

  if (item.type === "table" || item.type === "view") {
    btn.addEventListener("contextmenu", e => {
      e.preventDefault();
      import("./contextmenu").then(m => m.showCtxMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, { type: "table", item }));
    });
  }

  row.appendChild(btn);
  wrapper.appendChild(row);

  if (isExpandable && chevron) {
    const colList = document.createElement("div");
    colList.className = "tree-col-list";
    colList.hidden = true;
    wrapper.appendChild(colList);

    let expanded = false;
    chevron.addEventListener("click", async (e) => {
      e.stopPropagation();
      expanded = !expanded;
      chevron!.classList.toggle("open", expanded);
      colList.hidden = !expanded;
      if (expanded && !colList.dataset.loaded) {
        colList.dataset.loaded = "1";
        await loadColumnsInto(item, colList);
      }
    });
  }

  return wrapper;
}

async function loadColumnsInto(item: SchemaItem, colList: HTMLElement): Promise<void> {
  const conn = activeConn();
  if (!conn) return;

  const cacheKey = `${conn.id}:${item.parent ?? ""}.${item.name}`;
  const cached = S.columnCache.get(cacheKey);
  if (cached && cached !== "loading") { renderColumnNodes(cached as ColumnInfo[], colList); return; }
  if (cached === "loading") return;

  S.columnCache.set(cacheKey, "loading");
  colList.textContent = "";
  const loadingEl = document.createElement("div");
  loadingEl.className = "tree-col-loading";
  loadingEl.textContent = "Loading…";
  colList.appendChild(loadingEl);

  try {
    const data = await apiColumns(item.parent, item.name);
    const cols = data.columns as ColumnInfo[];
    S.columnCache.set(cacheKey, cols);
    renderColumnNodes(cols, colList);
  } catch (err) {
    S.columnCache.delete(cacheKey);
    colList.textContent = "";
    const errEl = document.createElement("div");
    errEl.className = "tree-col-error";
    errEl.textContent = (err as Error).message;
    colList.appendChild(errEl);
  }
}

function renderColumnNodes(columns: ColumnInfo[], colList: HTMLElement): void {
  colList.textContent = "";
  for (const col of columns) {
    const node = document.createElement("div");
    node.className = "tree-col-node";
    node.title = `${col.name} ${col.dataType}${col.nullable ? "" : " NOT NULL"}`;

    if (col.isPrimary) {
      const pk = document.createElement("span");
      pk.className = "tree-col-pk"; pk.textContent = "PK";
      node.appendChild(pk);
    }

    const colName = document.createElement("span");
    colName.className = "tree-col-name"; colName.textContent = col.name;

    const colType = document.createElement("span");
    colType.className = "tree-col-type"; colType.textContent = col.dataType;

    node.appendChild(colName);
    node.appendChild(colType);
    node.addEventListener("click", () => {
      const pos = el.editor.selectionStart;
      const v = el.editor.value;
      el.editor.value = v.slice(0, pos) + col.name + v.slice(el.editor.selectionEnd);
      el.editor.selectionStart = el.editor.selectionEnd = pos + col.name.length;
      import("./editor").then(e => { e.updateGutter(); e.updateHighlight(); });
      import("./tabs").then(t => t.flushTabContent());
      el.editor.focus();
    });
    colList.appendChild(node);
  }
  if (!columns.length) {
    const empty = document.createElement("div");
    empty.className = "tree-col-loading";
    empty.textContent = "No columns";
    colList.appendChild(empty);
  }
}
