// ═══════════════════════════════════════════════════════════
//  QueryForge — app.js
//  DOM refs first, then state, then logic, then boot
// ═══════════════════════════════════════════════════════════

// ─── DOM References (declared before any function) ────────
const el = {
  // App shell
  app:             document.getElementById("app"),
  sidebar:         document.getElementById("sidebar"),
  sidebarCollapse: document.getElementById("sidebarCollapse"),
  sidebarShowBtn:  document.getElementById("sidebarShowBtn"),
  // Connections
  connList:        document.getElementById("connList"),
  newConnBtn:      document.getElementById("newConnBtn"),
  // Schema explorer
  schemaTree:      document.getElementById("schemaTree"),
  schemaSearch:    document.getElementById("schemaSearch"),
  reloadSchema:    document.getElementById("reloadSchema"),
  // Tabs
  tabsTrack:       document.getElementById("tabsTrack"),
  addTabBtn:       document.getElementById("addTabBtn"),
  // Toolbar
  connPillDot:     document.getElementById("connPillDot"),
  connPillName:    document.getElementById("connPillName"),
  connPillChange:  document.getElementById("connPillChange"),
  toolbarDbLabel:  document.getElementById("toolbarDbLabel"),
  explainBtn:      document.getElementById("explainBtn"),
  runBtn:          document.getElementById("runBtn"),
  // Editor
  editor:          document.getElementById("editor"),
  gutter:          document.getElementById("gutter"),
  hlLayer:         document.getElementById("hlLayer"),
  // Divider / resize
  divider:         document.getElementById("divider"),
  editorPanel:     document.getElementById("editorPanel"),
  resultsPanel:    document.getElementById("resultsPanel"),
  tableEditorPanel: document.getElementById("tableEditorPanel"),
  workspace:       document.getElementById("workspace"),
  // Results
  resultsBody:     document.getElementById("resultsBody"),
  resultsEmpty:    document.getElementById("resultsEmpty"),
  resultsCount:    document.getElementById("resultsCount"),
  resultsTime:     document.getElementById("resultsTime"),
  copyJsonBtn:     document.getElementById("copyJsonBtn"),
  exportCsvBtn:    document.getElementById("exportCsvBtn"),
  // Status bar
  statusIndicator: document.getElementById("statusIndicator"),
  statusText:      document.getElementById("statusText"),
  // Explorer DDL buttons
  newSchemaBtn:    document.getElementById("newSchemaBtn"),
  newTableBtn:     document.getElementById("newTableBtn"),
  // Context menu
  ctxMenu:         document.getElementById("ctxMenu"),
  ctxNewTable:     document.getElementById("ctxNewTable"),
  ctxDropSchema:   document.getElementById("ctxDropSchema"),
  ctxEditTable:    document.getElementById("ctxEditTable"),
  ctxDropTable:    document.getElementById("ctxDropTable"),
  ctxTruncate:     document.getElementById("ctxTruncate"),
  // DDL modal
  ddlModal:        document.getElementById("ddlModal"),
  ddlModalTitle:   document.getElementById("ddlModalTitle"),
  ddlModalClose:   document.getElementById("ddlModalClose"),
  ddlFormArea:     document.getElementById("ddlFormArea"),
  ddlCancelBtn:    document.getElementById("ddlCancelBtn"),
  ddlGenerateBtn:  document.getElementById("ddlGenerateBtn"),
  // Sidebar footer
  themeBtn:        document.getElementById("themeBtn"),
  installBtn:      document.getElementById("installBtn"),
  // Connection modal
  connModal:       document.getElementById("connModal"),
  connModalClose:  document.getElementById("connModalClose"),
  connTestBtn:     document.getElementById("connTestBtn"),
  connSaveBtn:     document.getElementById("connSaveBtn"),
  connDeleteBtn:   document.getElementById("connDeleteBtn"),
  connTestResult:  document.getElementById("connTestResult"),
  connTestIcon:    document.getElementById("connTestIcon"),
  connTestMsg:     document.getElementById("connTestMsg"),
  connTestTime:    document.getElementById("connTestTime"),
  modalSavedList:  document.getElementById("modalSavedList"),
  mConnName:       document.getElementById("mConnName"),
  mDbType:         document.getElementById("mDbType"),
  mHost:           document.getElementById("mHost"),
  mHostLabel:      document.getElementById("mHostLabel"),
  mPort:           document.getElementById("mPort"),
  mPortField:      document.getElementById("mPortField"),
  mUser:           document.getElementById("mUser"),
  mPass:           document.getElementById("mPass"),
  mCredFields:     document.getElementById("mCredFields"),
  mDatabase:       document.getElementById("mDatabase"),
  mSsl:            document.getElementById("mSsl"),
  themeColorMeta:  document.getElementById("themeColorMeta"),
  acDropdown:      document.getElementById("acDropdown"),
};

// ─── State ────────────────────────────────────────────────
const S = {
  connections:   [],   // { id, name, type, host, port, user, password, database, ssl, uri }
  activeConnId:  null,
  tabs:          [],   // { id, title, content, dbType, connId }
  activeTabId:   null,
  schemaItems:   [],   // { name, type, parent? }
  columnCache:   new Map(), // "schema.table" -> ColumnInfo[] | "loading" | "error"
  lastColumns:   [],
  lastRows:      [],
  sortCol:       null,
  sortDir:       "asc",
  sidebarOpen:   true,
};

// ─── Persistence ──────────────────────────────────────────
function save() {
  localStorage.setItem("qf_tabs",  JSON.stringify({ tabs: S.tabs, activeTabId: S.activeTabId }));
  localStorage.setItem("qf_conns", JSON.stringify(S.connections));
  localStorage.setItem("qf_theme", document.documentElement.dataset.theme ?? "dark");
}

function load() {
  // Theme
  const theme = localStorage.getItem("qf_theme") ?? "dark";
  applyTheme(theme, false);

  // Connections
  try { S.connections = JSON.parse(localStorage.getItem("qf_conns") || "[]"); } catch {}

  // Tabs
  try {
    const d = JSON.parse(localStorage.getItem("qf_tabs") || "{}");
    if (Array.isArray(d.tabs) && d.tabs.length) {
      S.tabs = d.tabs;
      S.activeTabId = d.activeTabId || d.tabs[0].id;
    }
  } catch {}

  if (!S.tabs.length) createTab(false);

  // Sidebar state
  const sidebarPref = localStorage.getItem("qf_sidebar");
  if (sidebarPref === "0") setSidebar(false);
}

// ─── Theme ────────────────────────────────────────────────
const THEME_COLORS = { dark: "#1e1e1e", light: "#f6f8fa" };

function applyTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  el.themeColorMeta.content = THEME_COLORS[theme] ?? THEME_COLORS.dark;
  if (persist) save();
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
}

// ─── Sidebar ──────────────────────────────────────────────
function setSidebar(open) {
  S.sidebarOpen = open;
  el.app.classList.toggle("sidebar-hidden", !open);
  el.sidebarShowBtn.style.display = open ? "none" : "";
  localStorage.setItem("qf_sidebar", open ? "1" : "0");
}

// ─── Connection state helpers ──────────────────────────────
function activeConn() {
  return S.connections.find(c => c.id === S.activeConnId) ?? null;
}

function activeTab() {
  return S.tabs.find(t => t.id === S.activeTabId) ?? null;
}

// ─── Toolbar pill update ───────────────────────────────────
function updateToolbarPill() {
  const conn = activeConn();
  if (conn) {
    el.connPillDot.className = "conn-pill-dot live";
    el.connPillName.textContent = conn.name;
    el.toolbarDbLabel.textContent = conn.type.toUpperCase();
  } else {
    el.connPillDot.className = "conn-pill-dot";
    el.connPillName.textContent = "No connection";
    el.toolbarDbLabel.textContent = "";
  }
}

// ─── Tab Management ────────────────────────────────────────
const DB_BADGE = { postgres: "PG", mysql: "MY", mongodb: "MG", clickhouse: "CH" };

function createTab(persist = true) {
  const tab = activeTab();
  const id = `tab-${Date.now()}`;
  S.tabs.push({
    id,
    title: `Query ${S.tabs.length + 1}`,
    content: "",
    dbType: tab?.dbType ?? "postgres",
    connId: S.activeConnId,
  });
  S.activeTabId = id;
  if (persist) save();
  renderTabs();
  syncEditorFromTab();
}

function closeTab(id) {
  if (S.tabs.length === 1) return;
  const idx = S.tabs.findIndex(t => t.id === id);
  S.tabs = S.tabs.filter(t => t.id !== id);
  if (S.activeTabId === id) {
    S.activeTabId = S.tabs[Math.min(idx, S.tabs.length - 1)].id;
  }
  save();
  renderTabs();
  syncEditorFromTab();
}

function switchTab(id) {
  flushTabContent();
  S.activeTabId = id;
  save();
  renderTabs();
  syncEditorFromTab();
}

function flushTabContent() {
  const tab = activeTab();
  if (tab) {
    tab.content = el.editor.value;
    tab.connId  = S.activeConnId;
  }
}

function syncEditorFromTab() {
  const tab = activeTab();
  const isTblEditor = tab?.kind === "table-editor";

  el.workspace.hidden = isTblEditor;
  el.tableEditorPanel.hidden = !isTblEditor;

  if (isTblEditor) {
    mountTableEditorTab(tab);
    return;
  }

  el.editor.value = tab?.content ?? "";
  if (tab?.connId && tab.connId !== S.activeConnId) {
    S.activeConnId = tab.connId;
    updateToolbarPill();
    renderConnectionList();
  }
  updateGutter();
  updateHighlight();
  clearResults();
}

function renderTabs() {
  el.tabsTrack.textContent = "";
  for (const tab of S.tabs) {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", tab.id === S.activeTabId ? "true" : "false");
    btn.title = tab.title;

    const badge = document.createElement("span");
    if (tab.kind === "table-editor") {
      badge.className = "tab-badge tab-badge--tbl";
      badge.textContent = "TBL";
    } else {
      badge.className = `tab-badge ${tab.dbType ?? "postgres"}`;
      badge.textContent = DB_BADGE[tab.dbType] ?? "DB";
    }

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title;

    const close = document.createElement("button");
    close.className = "tab-close";
    close.textContent = "×";
    close.setAttribute("aria-label", `Close ${tab.title}`);
    close.addEventListener("click", e => { e.stopPropagation(); closeTab(tab.id); });

    btn.appendChild(badge);
    btn.appendChild(title);
    btn.appendChild(close);
    btn.addEventListener("click", () => switchTab(tab.id));
    el.tabsTrack.appendChild(btn);
  }
}

// ─── Connection List (sidebar) ─────────────────────────────
function renderConnectionList() {
  el.connList.textContent = "";
  if (!S.connections.length) {
    const msg = document.createElement("div");
    msg.className = "empty-state";
    msg.textContent = "No connections. Click + to add one.";
    el.connList.appendChild(msg);
    return;
  }

  for (const conn of S.connections) {
    const item = document.createElement("button");
    item.className = `conn-item${conn.id === S.activeConnId ? " active" : ""}`;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", conn.id === S.activeConnId ? "true" : "false");
    item.title = `${conn.name} — ${conn.type}`;

    const dot = document.createElement("span");
    dot.className = `conn-dot${conn.id === S.activeConnId ? " live" : ""}`;

    const name = document.createElement("span");
    name.className = "conn-item-name";
    name.textContent = conn.name;

    const typeBadge = document.createElement("span");
    typeBadge.className = `conn-item-type ${conn.type}`;
    typeBadge.textContent = DB_BADGE[conn.type] ?? conn.type;

    const editBtn = document.createElement("button");
    editBtn.className = "conn-item-edit";
    editBtn.textContent = "···";
    editBtn.setAttribute("aria-label", `Edit ${conn.name}`);
    editBtn.addEventListener("click", e => { e.stopPropagation(); openModal(conn.id); });

    item.appendChild(dot);
    item.appendChild(name);
    item.appendChild(typeBadge);
    item.appendChild(editBtn);
    item.addEventListener("click", () => activateConn(conn.id));
    el.connList.appendChild(item);
  }
}

function activateConn(id) {
  S.activeConnId = id;
  const tab = activeTab();
  if (tab) { tab.connId = id; }
  save();
  renderConnectionList();
  updateToolbarPill();
  loadSchema();
}

// ─── Schema Tree ───────────────────────────────────────────
const OBJECT_ORDER = ["table", "view", "function", "index", "collection"];
const OBJECT_LABELS = { table: "Tables", view: "Views", function: "Functions", index: "Indexes", collection: "Collections" };
const SYSTEM_SCHEMAS = new Set(["pg_catalog", "information_schema", "pg_toast"]);

function renderSchemaTree() {
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

  // Build: schema -> type -> items[]
  const bySchema = new Map(); // schema name -> Map(type -> items[])
  const noSchema = new Map(); // type -> items[]  (for MySQL/Mongo/etc)

  for (const item of items) {
    if (item.type === "schema") continue;
    const target = item.parent ? bySchema : noSchema;
    const key = item.parent ?? "";
    if (item.parent && !bySchema.has(item.parent)) bySchema.set(item.parent, new Map());
    const typeMap = item.parent ? bySchema.get(item.parent) : noSchema;
    if (!typeMap.has(item.type)) typeMap.set(item.type, []);
    typeMap.get(item.type).push(item);
  }

  // Render schemas in declared order
  const schemas = items.filter(i => i.type === "schema");
  for (const schema of schemas) {
    const typeMap = bySchema.get(schema.name) ?? new Map();
    el.schemaTree.appendChild(makeSchemaGroup(schema.name, typeMap));
  }

  // Fallback for DBs without schema concept (MySQL, MongoDB, ClickHouse)
  if (!schemas.length) {
    for (const [type, list] of noSchema) {
      const label = OBJECT_LABELS[type] ?? type;
      el.schemaTree.appendChild(makeTypeGroup(label, list));
    }
  }
}

function makeCollapsibleHeader(label, depth = 0) {
  const hdr = document.createElement("button");
  hdr.className = depth === 0 ? "tree-schema-node" : "tree-type-node";

  const chev = document.createElement("span");
  chev.className = "tree-chevron open";
  chev.setAttribute("aria-hidden", "true");
  const chevSvg = makeSvgIcon("10", "10", [svgEl("polyline", { points: "9 18 15 12 9 6" })]);
  chevSvg.setAttribute("stroke-width", "2.5");
  chev.appendChild(chevSvg);

  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  hdr.appendChild(chev);
  hdr.appendChild(labelEl);
  return { hdr, chev };
}

function makeSchemaGroup(schemaName, typeMap) {
  const group = document.createElement("div");
  group.className = "tree-group";

  const isSystem = SYSTEM_SCHEMAS.has(schemaName);

  // Schema header
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

  // Object count badge
  let totalObjects = 0;
  for (const [,list] of typeMap) totalObjects += list.length;
  const badge = document.createElement("span");
  badge.className = "tree-schema-badge";
  badge.textContent = totalObjects || "";

  // Action buttons on hover
  const actions = document.createElement("span");
  actions.className = "tree-hdr-actions";

  const addTableBtn = document.createElement("button");
  addTableBtn.className = "tree-hdr-btn";
  addTableBtn.title = "New table";
  addTableBtn.appendChild(makeSvgIcon("11","11",[svgEl("line",{x1:"12",y1:"5",x2:"12",y2:"19"}),svgEl("line",{x1:"5",y1:"12",x2:"19",y2:"12"})]));
  addTableBtn.addEventListener("click", e => { e.stopPropagation(); openDdlModal("table", { schema: schemaName }); });

  const moreBtn = document.createElement("button");
  moreBtn.className = "tree-hdr-btn";
  moreBtn.title = "More options";
  moreBtn.appendChild(makeSvgIcon("11","11",[
    svgEl("circle",{cx:"12",cy:"5",r:"1"}),svgEl("circle",{cx:"12",cy:"12",r:"1"}),svgEl("circle",{cx:"12",cy:"19",r:"1"}),
  ]));
  moreBtn.addEventListener("click", e => {
    e.stopPropagation();
    showCtxMenu(e.clientX, e.clientY, { type: "schema", item: { name: schemaName } });
  });

  actions.appendChild(addTableBtn);
  actions.appendChild(moreBtn);

  hdr.appendChild(chev);
  hdr.appendChild(schemaIcon);
  hdr.appendChild(nameEl);
  hdr.appendChild(badge);
  hdr.appendChild(actions);

  // Children
  const children = document.createElement("div");
  children.className = "tree-children" + (isSystem ? "" : " open");

  // Flat list: all items sorted by type order then name
  const allItems = [];
  for (const type of OBJECT_ORDER) {
    const list = typeMap.get(type) ?? [];
    for (const item of list) allItems.push(item);
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
  hdr.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  hdr.addEventListener("contextmenu", e => {
    e.preventDefault();
    showCtxMenu(e.clientX, e.clientY, { type: "schema", item: { name: schemaName } });
  });

  group.appendChild(hdr);
  group.appendChild(children);
  return group;
}

function makeTypeGroup(label, items, type = "") {
  // Used only for non-schema DBs (MySQL root, MongoDB root)
  const group = document.createElement("div");
  group.className = "tree-group";
  for (const item of items) group.appendChild(makeTableNode(item));
  return group;
}

// SVG icon builders using safe DOM APIs (no innerHTML)
const svgNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function makeSvgIcon(width, height, children) {
  const svg = svgEl("svg", { width, height, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.8" });
  for (const child of children) svg.appendChild(child);
  return svg;
}
const NODE_ICONS = {
  table: () => makeSvgIcon("12","12",[
    svgEl("rect",{x:"3",y:"3",width:"18",height:"18",rx:"2"}),
    svgEl("line",{x1:"3",y1:"9",x2:"21",y2:"9"}),
    svgEl("line",{x1:"3",y1:"15",x2:"21",y2:"15"}),
    svgEl("line",{x1:"9",y1:"3",x2:"9",y2:"21"}),
  ]),
  view: () => makeSvgIcon("12","12",[
    svgEl("path",{d:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"}),
    svgEl("circle",{cx:"12",cy:"12",r:"3"}),
  ]),
  function: () => makeSvgIcon("12","12",[
    svgEl("polyline",{points:"4 17 10 11 4 5"}),
    svgEl("line",{x1:"12",y1:"19",x2:"20",y2:"19"}),
  ]),
  index: () => makeSvgIcon("12","12",[
    svgEl("line",{x1:"4",y1:"9",x2:"20",y2:"9"}),
    svgEl("line",{x1:"4",y1:"15",x2:"20",y2:"15"}),
    svgEl("polyline",{points:"10 3 4 9 10 15"}),
  ]),
  collection: () => makeSvgIcon("12","12",[
    svgEl("ellipse",{cx:"12",cy:"6",rx:"9",ry:"3.5"}),
    svgEl("path",{d:"M3 6v5c0 1.93 4.03 3.5 9 3.5s9-1.57 9-3.5V6"}),
    svgEl("path",{d:"M3 11v5c0 1.93 4.03 3.5 9 3.5s9-1.57 9-3.5v-5"}),
  ]),
};

function makeTableNode(item) {
  const isExpandable = item.type === "table" || item.type === "view";
  const wrapper = document.createElement("div");
  wrapper.className = "tree-table-wrapper";

  const row = document.createElement("div");
  row.className = "tree-table-row";

  // Expand chevron
  let chevron = null;
  if (isExpandable) {
    chevron = document.createElement("span");
    chevron.className = "tree-chevron tree-col-chevron";
    chevron.setAttribute("aria-hidden", "true");
    const chevSvg = makeSvgIcon("9", "9", [svgEl("polyline", { points: "9 18 15 12 9 6" })]);
    chevSvg.setAttribute("stroke-width", "2.5");
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

  // Show type badge for non-table objects so they're distinguishable in flat list
  if (item.type !== "table" && item.type !== "collection") {
    const typeBadge = document.createElement("span");
    typeBadge.className = "tree-node-type-badge";
    const BADGE = { view: "V", function: "fn", index: "idx" };
    typeBadge.textContent = BADGE[item.type] ?? item.type[0];
    btn.appendChild(typeBadge);
  }

  btn.addEventListener("click", () => {
    el.editor.value = makeQueryTemplate(item);
    flushTabContent();
    save();
    updateGutter();
    updateHighlight();
    el.editor.focus();
  });

  if (item.type === "table" || item.type === "view") {
    btn.addEventListener("contextmenu", e => {
      e.preventDefault();
      showCtxMenu(e.clientX, e.clientY, { type: "table", item });
    });
  }

  row.appendChild(btn);
  wrapper.appendChild(row);

  if (isExpandable) {
    const colList = document.createElement("div");
    colList.className = "tree-col-list";
    colList.hidden = true;
    wrapper.appendChild(colList);

    let expanded = false;
    chevron.addEventListener("click", async (e) => {
      e.stopPropagation();
      expanded = !expanded;
      chevron.classList.toggle("open", expanded);
      colList.hidden = !expanded;
      if (expanded && !colList.dataset.loaded) {
        colList.dataset.loaded = "1";
        await loadColumnsInto(item, colList);
      }
    });
  }

  return wrapper;
}

async function loadColumnsInto(item, colList) {
  const conn = activeConn();
  if (!conn) return;

  const cacheKey = `${conn.id}:${item.parent ?? ""}.${item.name}`;
  const cached = S.columnCache.get(cacheKey);
  if (cached && cached !== "loading") { renderColumnNodes(cached, colList); return; }
  if (cached === "loading") return;

  S.columnCache.set(cacheKey, "loading");
  colList.textContent = "";
  const loadingEl = document.createElement("div");
  loadingEl.className = "tree-col-loading";
  loadingEl.textContent = "Loading…";
  colList.appendChild(loadingEl);

  try {
    const res = await fetch("/api/columns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: conn.type, connection: buildConnPayload(), schema: item.parent, table: item.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    S.columnCache.set(cacheKey, data.columns);
    renderColumnNodes(data.columns, colList);
  } catch (err) {
    S.columnCache.delete(cacheKey);
    colList.textContent = "";
    const errEl = document.createElement("div");
    errEl.className = "tree-col-error";
    errEl.textContent = err.message;
    colList.appendChild(errEl);
  }
}

function renderColumnNodes(columns, colList) {
  colList.textContent = "";
  for (const col of columns) {
    const node = document.createElement("div");
    node.className = "tree-col-node";
    node.title = `${col.name} ${col.dataType}${col.nullable ? "" : " NOT NULL"}`;

    if (col.isPrimary) {
      const pk = document.createElement("span");
      pk.className = "tree-col-pk";
      pk.textContent = "PK";
      node.appendChild(pk);
    }

    const colName = document.createElement("span");
    colName.className = "tree-col-name";
    colName.textContent = col.name;

    const colType = document.createElement("span");
    colType.className = "tree-col-type";
    colType.textContent = col.dataType;

    node.appendChild(colName);
    node.appendChild(colType);
    node.addEventListener("click", () => {
      const pos = el.editor.selectionStart;
      const v = el.editor.value;
      el.editor.value = v.slice(0, pos) + col.name + v.slice(el.editor.selectionEnd);
      el.editor.selectionStart = el.editor.selectionEnd = pos + col.name.length;
      updateGutter();
      updateHighlight();
      flushTabContent();
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

function makeQueryTemplate(item) {
  const dbType = activeConn()?.type ?? "postgres";
  const q = (s) => `"${s}"`;
  const ref = item.parent ? `${q(item.parent)}.${q(item.name)}` : q(item.name);

  if (dbType === "mongodb") return JSON.stringify({ collection: item.name, action: "find", filter: {}, limit: 100 }, null, 2);
  if (dbType === "clickhouse") {
    const ref2 = item.parent ? `${item.parent}.${item.name}` : item.name;
    return item.type === "function"
      ? `-- function: ${ref2}\nSELECT ${ref2}();`
      : `SELECT *\nFROM ${ref2}\nLIMIT 100;`;
  }

  switch (item.type) {
    case "view":
      return `SELECT *\nFROM ${ref}\nLIMIT 100;`;
    case "function":
      return `-- function: ${ref}\nSELECT ${ref}();`;
    case "index":
      return `SELECT indexname, indexdef\nFROM pg_indexes\nWHERE schemaname = '${item.parent}'\n  AND indexname = '${item.name}';`;
    default:
      return item.parent
        ? `SELECT *\nFROM ${ref}\nLIMIT 100;`
        : `SELECT table_name FROM information_schema.tables WHERE table_schema = '${item.name}';`;
  }
}

// ─── API ──────────────────────────────────────────────────
function buildConnPayload() {
  const conn = activeConn();
  if (!conn) return null;
  if (conn.type === "mongodb") return { uri: conn.uri || conn.host, database: conn.database };
  return { host: conn.host, port: conn.port, user: conn.user, password: conn.password, database: conn.database, ssl: conn.ssl };
}

async function runQuery() {
  flushTabContent();
  save();

  const conn = activeConn();
  if (!conn) { setStatus("error", "No connection selected"); return; }

  const query = el.editor.value.trim();
  if (!query) { setStatus("idle", "Nothing to run"); return; }

  setStatus("loading", "Running…");
  showLoading();

  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: conn.type, connection: buildConnPayload(), query }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Query failed");

    S.lastColumns = data.columns;
    S.lastRows    = data.rows;
    S.sortCol     = null;
    S.sortDir     = "asc";

    renderResultTable(data.columns, data.rows);
    el.resultsCount.textContent = `${data.rowCount} rows`;
    el.resultsCount.hidden = false;
    el.resultsTime.textContent  = `${Math.round(data.elapsedMs)} ms`;
    el.resultsTime.hidden = false;
    el.copyJsonBtn.hidden = false;
    el.exportCsvBtn.hidden = false;
    setStatus("ok", `${conn.type} · ${data.rowCount} rows · ${Math.round(data.elapsedMs)} ms`);
  } catch (err) {
    showError(err.message);
    el.resultsCount.hidden = true;
    el.resultsTime.hidden  = true;
    el.copyJsonBtn.hidden  = true;
    el.exportCsvBtn.hidden = true;
    setStatus("error", `Error: ${err.message}`);
  }
}

async function runExplain() {
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
  updateGutter();
  updateHighlight();
  await runQuery();
}

async function loadSchema() {
  const conn = activeConn();
  if (!conn) return;
  S.columnCache.clear();
  setStatus("loading", "Loading schema…");
  try {
    const res = await fetch("/api/schema", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: conn.type, connection: buildConnPayload() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Schema failed");
    S.schemaItems = data.items ?? [];
    renderSchemaTree();
    setStatus("ok", `${conn.name} — ${S.schemaItems.filter(i => i.type !== "schema").length} tables`);
  } catch (err) {
    setStatus("error", `Schema: ${err.message}`);
    const errEl = document.createElement("div");
    errEl.className = "empty-state";
    errEl.style.color = "var(--red)";
    errEl.textContent = err.message;
    el.schemaTree.textContent = "";
    el.schemaTree.appendChild(errEl);
  }
}

async function testConnPayload(payload, type) {
  const res = await fetch("/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, connection: payload }),
  });
  return res.json();
}

// ─── Results rendering ─────────────────────────────────────
function clearResults() {
  el.resultsBody.textContent = "";
  el.resultsBody.appendChild(el.resultsEmpty);
  el.resultsEmpty.hidden = false;
  el.resultsCount.hidden = true;
  el.resultsTime.hidden  = true;
  el.copyJsonBtn.hidden  = true;
  el.exportCsvBtn.hidden = true;
}

function showLoading() {
  el.resultsBody.textContent = "";
  const wrap = document.createElement("div");
  wrap.className = "result-loading";
  const sp = document.createElement("span");
  sp.className = "spinner";
  wrap.appendChild(sp);
  wrap.appendChild(document.createTextNode(" Running…"));
  el.resultsBody.appendChild(wrap);
}

function showError(msg) {
  el.resultsBody.textContent = "";
  const box = document.createElement("div");
  box.className = "result-error";
  box.textContent = `⚠ ${msg}`;
  el.resultsBody.appendChild(box);
}

function renderResultTable(cols, rows) {
  el.resultsBody.textContent = "";

  if (!cols.length && !rows.length) {
    const ok = document.createElement("div");
    ok.className = "result-ok-empty";
    ok.textContent = "Query executed successfully — no rows returned.";
    el.resultsBody.appendChild(ok);
    return;
  }

  const sorted = sortedRows(rows);
  const table  = buildTable(cols, sorted);
  el.resultsBody.appendChild(table);
}

function sortedRows(rows) {
  if (!S.sortCol) return rows;
  return [...rows].sort((a, b) => {
    const av = a[S.sortCol], bv = b[S.sortCol];
    const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : av > bv ? 1 : 0;
    return S.sortDir === "asc" ? cmp : -cmp;
  });
}

function buildTable(cols, rows) {
  const tbl = document.createElement("table");
  tbl.className = "rtable";

  // thead
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

  // tbody
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const col of cols) {
      const td = document.createElement("td");
      const val = row[col];
      if (val == null) {
        td.textContent = "NULL";
        td.className = "cell-null";
      } else if (typeof val === "boolean") {
        td.textContent = String(val);
        td.className = "cell-bool";
      } else if (typeof val === "number") {
        td.textContent = String(val);
        td.className = "cell-num";
      } else if (typeof val === "object") {
        td.textContent = JSON.stringify(val);
      } else {
        td.textContent = String(val);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);
  return tbl;
}

// ─── Export ────────────────────────────────────────────────
function doExportCsv() {
  const { lastColumns: cols, lastRows: rows } = S;
  if (!cols.length) return;
  const lines = [cols.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(cols.map(c => csvEscape(row[c] == null ? "" : String(row[c]))).join(","));
  }
  download(lines.join("\r\n"), "result.csv", "text/csv");
}

function doCopyJson() {
  navigator.clipboard.writeText(JSON.stringify(S.lastRows, null, 2))
    .then(() => setStatus("ok", "Copied JSON to clipboard"));
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(text, name, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Status bar ────────────────────────────────────────────
function setStatus(state, msg) {
  el.statusIndicator.dataset.state = state;
  el.statusText.textContent = msg;
}

// ─── SQL Syntax Highlighting ───────────────────────────────
const SQL_KW = new Set([
  "SELECT","FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER","FULL","CROSS","NATURAL",
  "ON","AS","AND","OR","NOT","IN","IS","NULL","LIKE","ILIKE","BETWEEN","ORDER","BY",
  "GROUP","HAVING","LIMIT","OFFSET","INSERT","INTO","VALUES","UPDATE","SET","DELETE",
  "CREATE","TABLE","VIEW","INDEX","DROP","ALTER","ADD","COLUMN","PRIMARY","KEY","FOREIGN",
  "REFERENCES","UNIQUE","DEFAULT","CONSTRAINT","WITH","UNION","ALL","DISTINCT","EXISTS",
  "CASE","WHEN","THEN","ELSE","END","OVER","PARTITION","WINDOW","LATERAL","RECURSIVE",
  "COUNT","SUM","AVG","MIN","MAX","COALESCE","NULLIF","CAST","CONVERT","NOW","CURRENT_DATE",
  "CURRENT_TIMESTAMP","DATE","TRIM","UPPER","LOWER","ROUND","FLOOR","CEIL","ABS",
  "LENGTH","SUBSTR","SUBSTRING","REPLACE","CONCAT","SHOW","DESCRIBE","EXPLAIN",
  "USE","DATABASE","DATABASES","TABLES","FORMAT","SETTINGS","ARRAY","TUPLE",
  "TRUE","FALSE","ASC","DESC","USING","RETURNING","CONFLICT","DO","NOTHING","UPDATE",
  "FILTER","ROLLUP","CUBE","GROUPING","SETS","FETCH","NEXT","ROWS","ONLY","TIES",
]);

function tokenize(text) {
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    // Block comment /* ... */
    if (text[i] === "/" && text[i+1] === "*") {
      const end = text.indexOf("*/", i+2);
      const val = end === -1 ? text.slice(i) : text.slice(i, end + 2);
      tokens.push({ t: "cmt", v: val });
      i += val.length;
      continue;
    }
    // Line comment --
    if (text[i] === "-" && text[i+1] === "-") {
      const end = text.indexOf("\n", i);
      const val = end === -1 ? text.slice(i) : text.slice(i, end + 1);
      tokens.push({ t: "cmt", v: val });
      i += val.length;
      continue;
    }
    // Single-quoted string
    if (text[i] === "'") {
      let j = i + 1;
      while (j < text.length && !(text[j] === "'" && text[j-1] !== "\\")) j++;
      tokens.push({ t: "str", v: text.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Double-quoted identifier
    if (text[i] === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j++;
      tokens.push({ t: "fn", v: text.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Backtick identifier
    if (text[i] === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== "`") j++;
      tokens.push({ t: "fn", v: text.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // Number
    if (/[0-9]/.test(text[i]) && (i === 0 || /\W/.test(text[i-1]))) {
      let j = i;
      while (j < text.length && /[0-9._eExX]/.test(text[j])) j++;
      tokens.push({ t: "num", v: text.slice(i, j) });
      i = j;
      continue;
    }
    // Word → keyword or identifier
    if (/[a-zA-Z_]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[a-zA-Z0-9_$]/.test(text[j])) j++;
      const word = text.slice(i, j);
      tokens.push({ t: SQL_KW.has(word.toUpperCase()) ? "kw" : "text", v: word });
      i = j;
      continue;
    }
    // Operators
    if (/[=<>!+\-*/|&~%^]/.test(text[i])) {
      tokens.push({ t: "op", v: text[i] });
      i++;
      continue;
    }
    tokens.push({ t: "text", v: text[i] });
    i++;
  }
  return tokens;
}

function updateHighlight() {
  el.hlLayer.textContent = "";
  const frag = document.createDocumentFragment();
  for (const tok of tokenize(el.editor.value)) {
    if (tok.t === "text") {
      frag.appendChild(document.createTextNode(tok.v));
    } else {
      const span = document.createElement("span");
      span.className = `tok-${tok.t}`;
      span.textContent = tok.v;
      frag.appendChild(span);
    }
  }
  frag.appendChild(document.createTextNode("\n"));
  el.hlLayer.appendChild(frag);
}

// ─── Line numbers (gutter) ─────────────────────────────────
function updateGutter() {
  const n = (el.editor.value.match(/\n/g) || []).length + 1;
  const cur = el.gutter.children.length;
  if (n > cur) {
    for (let i = cur + 1; i <= n; i++) {
      const span = document.createElement("span");
      span.textContent = i;
      el.gutter.appendChild(span);
    }
  } else {
    while (el.gutter.children.length > n) {
      el.gutter.removeChild(el.gutter.lastChild);
    }
  }
}

function syncScroll() {
  el.gutter.scrollTop   = el.editor.scrollTop;
  el.hlLayer.scrollTop  = el.editor.scrollTop;
  el.hlLayer.scrollLeft = el.editor.scrollLeft;
}

// ─── Resize (drag divider) ─────────────────────────────────
function initResize() {
  let drag = false, startY = 0, startH = 0;

  el.divider.addEventListener("mousedown", e => {
    drag = true;
    startY = e.clientY;
    startH = el.editorPanel.offsetHeight;
    el.divider.classList.add("dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
  });

  // Also allow keyboard resize on the divider
  el.divider.addEventListener("keydown", e => {
    const step = e.shiftKey ? 50 : 20;
    const cur = el.editorPanel.offsetHeight;
    const parent = el.editorPanel.parentElement.offsetHeight;
    if (e.key === "ArrowUp")   setEditorHeight(Math.max(80, cur - step), parent);
    if (e.key === "ArrowDown") setEditorHeight(Math.min(parent - 80, cur + step), parent);
  });

  document.addEventListener("mousemove", e => {
    if (!drag) return;
    const parent = el.editorPanel.parentElement.offsetHeight;
    setEditorHeight(startH + (e.clientY - startY), parent);
  });

  document.addEventListener("mouseup", () => {
    if (!drag) return;
    drag = false;
    el.divider.classList.remove("dragging");
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  });
}

function setEditorHeight(h, parentH) {
  const clamped = Math.max(80, Math.min(h, parentH - 80 - el.divider.offsetHeight));
  el.editorPanel.style.flex = "none";
  el.editorPanel.style.height = `${clamped}px`;
  el.resultsPanel.style.flex = "1 1 0";
  syncScroll();
}

// ─── Connection Modal ──────────────────────────────────────
const MODAL_DEFAULTS = {
  postgres:   { host: "localhost", port: "5432",  user: "postgres", db: "postgres" },
  mysql:      { host: "localhost", port: "3306",  user: "root",     db: "" },
  mongodb:    { host: "mongodb://localhost:27017", port: "", user: "", db: "test" },
  clickhouse: { host: "http://localhost:8123",     port: "", user: "default", db: "default" },
};

let _editingConnId = null;

function openModal(connId = null) {
  _editingConnId = connId;
  const conn = connId ? S.connections.find(c => c.id === connId) : null;

  el.connModal.hidden = false;
  el.connModal.removeAttribute("hidden");

  el.connModal.querySelector(".modal-title").textContent = conn ? "Edit Connection" : "New Connection";
  el.connDeleteBtn.hidden = !conn;

  el.mConnName.value  = conn?.name ?? "";
  el.mDbType.value    = conn?.type ?? "postgres";
  el.mHost.value      = conn?.host ?? conn?.uri ?? "";
  el.mPort.value      = conn?.port ? String(conn.port) : "";
  el.mUser.value      = conn?.user ?? "";
  el.mPass.value      = conn?.password ?? "";
  el.mDatabase.value  = conn?.database ?? "";
  el.mSsl.checked     = conn?.ssl ?? false;

  el.connTestResult.hidden = true;
  el.connTestResult.className = "conn-test-result";
  if (el.connTestIcon)  el.connTestIcon.textContent = "";
  if (el.connTestMsg)   el.connTestMsg.textContent  = "";
  if (el.connTestTime)  el.connTestTime.textContent = "";

  updateModalForType(el.mDbType.value, !!conn);
  renderModalSavedList();

  // Focus first field
  requestAnimationFrame(() => el.mConnName.focus());
}

function closeModal() {
  el.connModal.hidden = true;
  _editingConnId = null;
}

function updateModalForType(type, preserveValues = false) {
  const isMongo = type === "mongodb";
  el.mHostLabel.textContent = isMongo ? "Connection URI" : "Host";
  el.mHost.placeholder = isMongo ? "mongodb://localhost:27017" : "localhost";
  el.mPortField.style.display  = isMongo ? "none" : "";
  el.mCredFields.style.display = isMongo ? "none" : "";

  if (!preserveValues && !el.mHost.value) {
    el.mHost.value = MODAL_DEFAULTS[type]?.host ?? "";
    el.mPort.value = MODAL_DEFAULTS[type]?.port ?? "";
    el.mUser.value = MODAL_DEFAULTS[type]?.user ?? "";
  }
}

function renderModalSavedList() {
  el.modalSavedList.textContent = "";
  if (!S.connections.length) {
    const msg = document.createElement("div");
    msg.className = "empty-state";
    msg.textContent = "No saved connections";
    el.modalSavedList.appendChild(msg);
    return;
  }
  for (const conn of S.connections) {
    const item = document.createElement("div");
    item.className = `modal-saved-item${conn.id === _editingConnId ? " active" : ""}`;

    const name = document.createElement("span");
    name.className = "saved-item-name";
    name.textContent = conn.name;

    const info = document.createElement("span");
    info.className = "saved-item-info";
    info.textContent = `${conn.type} · ${conn.host || conn.uri || ""}`;

    item.appendChild(name);
    item.appendChild(info);
    item.addEventListener("click", () => { closeModal(); openModal(conn.id); });
    el.modalSavedList.appendChild(item);
  }
}

function modalPayload() {
  const type = el.mDbType.value;
  if (type === "mongodb") return { uri: el.mHost.value, database: el.mDatabase.value };
  return {
    host: el.mHost.value,
    port: el.mPort.value ? Number(el.mPort.value) : undefined,
    user: el.mUser.value,
    password: el.mPass.value,
    database: el.mDatabase.value,
    ssl: el.mSsl.checked || undefined,
  };
}

async function saveConn() {
  const type = el.mDbType.value;
  const name = el.mConnName.value.trim() || `${type}-${el.mDatabase.value || "default"}`;
  const payload = modalPayload();

  const conn = {
    id:       _editingConnId || `conn-${Date.now()}`,
    name,
    type,
    host:     payload.host ?? "",
    uri:      payload.uri  ?? "",
    port:     payload.port,
    user:     payload.user ?? "",
    password: payload.password ?? "",
    database: payload.database ?? "",
    ssl:      payload.ssl ?? false,
  };

  if (_editingConnId) {
    const idx = S.connections.findIndex(c => c.id === _editingConnId);
    if (idx >= 0) S.connections[idx] = conn;
  } else {
    S.connections.push(conn);
  }

  save();
  renderConnectionList();
  closeModal();
  activateConn(conn.id);
}

// ─── PWA Install ──────────────────────────────────────────
let _deferredInstall = null;

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  _deferredInstall = e;
  el.installBtn.style.display = "";
});

window.addEventListener("appinstalled", () => {
  el.installBtn.style.display = "none";
  _deferredInstall = null;
  setStatus("ok", "App installed!");
});


// ─── DDL Tools ────────────────────────────────────────────
let _ddlMode = null;    // "schema" | "table" | "edit-table"
let _ddlContext = null; // { schema?, item?, originalCols? }
let _ctxTarget = null;  // { item, type: "schema"|"table" }
let _tblCols    = [];   // [{ id, name, type, notNull, pk, unique, default, original }]
let _tblIndexes = [];   // [{ id, name, columns, unique }]
let _tblFKeys   = [];   // [{ id, column, refTable, refColumn, onDelete }]
let _tblTab     = "columns"; // active tab

const PG_TYPES = ["integer","bigint","smallint","serial","bigserial","text","varchar(255)","char(1)","boolean","numeric(10,2)","real","double precision","date","timestamp","timestamptz","uuid","json","jsonb","bytea","text[]"];
const MY_TYPES = ["INT","BIGINT","SMALLINT","TINYINT","VARCHAR(255)","TEXT","MEDIUMTEXT","LONGTEXT","CHAR(1)","BOOLEAN","FLOAT","DOUBLE","DECIMAL(10,2)","DATE","DATETIME","TIMESTAMP","JSON","BLOB","UUID"];

function _uid() { return Math.random().toString(36).slice(2, 9); }
function _dbTypes() { return (activeConn()?.type ?? "postgres") === "mysql" ? MY_TYPES : PG_TYPES; }
function _q(s) { return (activeConn()?.type ?? "postgres") === "mysql" ? `\`${s}\`` : `"${s}"`; }

// ── Schema modal (simple) ──────────────────────────────────
function openDdlModal(mode, context = {}) {
  if (mode !== "schema") { openTableEditor(null, context); return; }
  _ddlMode = "schema";
  _ddlContext = context;
  el.ddlModal.hidden = false;
  el.ddlFormArea.textContent = "";
  el.ddlModalTitle.textContent = "New Schema";
  el.ddlGenerateBtn.textContent = "Create";
  el.ddlGenerateBtn.disabled = false;
  el.ddlModal.classList.remove("modal--tbl");
  const field = makeFormField("Schema name", "text", "my_schema", "ddlSchemaName");
  el.ddlFormArea.appendChild(field);
  requestAnimationFrame(() => el.ddlFormArea.querySelector("input")?.focus());
}

function makeFormField(label, type, placeholder, id, options = []) {
  const wrap = document.createElement("div");
  wrap.className = "form-field";
  const lbl = document.createElement("label");
  lbl.textContent = label; lbl.htmlFor = id;
  wrap.appendChild(lbl);
  if (type === "select") {
    const sel = document.createElement("select");
    sel.id = id;
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o; opt.textContent = o; sel.appendChild(opt);
    }
    wrap.appendChild(sel);
  } else {
    const inp = document.createElement("input");
    inp.type = type; inp.id = id; inp.placeholder = placeholder; inp.autocomplete = "off";
    wrap.appendChild(inp);
  }
  return wrap;
}

function closeDdlModal() {
  el.ddlModal.hidden = true;
  el.ddlModal.classList.remove("modal--tbl");
  el.ddlGenerateBtn.textContent = "Create";
  el.ddlGenerateBtn.disabled = false;
  _ddlMode = null; _ddlContext = null;
  _tblCols = []; _tblIndexes = []; _tblFKeys = [];
}

// ── Table editor (grid) ───────────────────────────────────
// Opens a table-editor tab (create or edit). Each tab stores its own state.
function openTableEditor(item, context = {}) {
  // Reuse existing tab for same table
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
    // per-tab state (populated in mountTableEditorTab)
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

async function openEditTableModal(item) { openTableEditor(item); }

// Called by syncEditorFromTab when active tab is a table-editor
async function mountTableEditorTab(tab) {
  const panel = el.tableEditorPanel;
  panel.textContent = "";

  // Restore per-tab DDL state
  _ddlMode    = tab.tblItem ? "edit-table" : "table";
  _ddlContext = { item: tab.tblItem, schema: tab.tblContext?.schema, originalCols: tab.originalCols };
  _tblCols    = tab.tblCols ?? [];
  _tblIndexes = tab.tblIndexes ?? [];
  _tblFKeys   = tab.tblFKeys ?? [];
  _tblTab     = tab.tblTab ?? "columns";

  // ── Header bar (schema + name + action buttons) ─────────
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
  const ni = document.createElement("input");
  ni.id = "tblNameInput"; ni.placeholder = "new_table"; ni.autocomplete = "off";
  ni.value = tab.tblItem?.name ?? "";
  ni.addEventListener("input", () => {
    tab.title = ni.value || "New Table";
    renderTabs();
  });
  nw.appendChild(nl); nw.appendChild(ni); topBar.appendChild(nw);

  // Spacer + Apply/Create button
  const spacer = document.createElement("div"); spacer.style.flex = "1";
  topBar.appendChild(spacer);

  const applyBtn = document.createElement("button");
  applyBtn.className = "btn btn-primary tep-apply-btn";
  applyBtn.textContent = tab.tblItem ? "Apply changes" : "Create table";
  applyBtn.addEventListener("click", async () => {
    _tblCols = tab.tblCols ?? _tblCols;
    _tblIndexes = tab.tblIndexes ?? _tblIndexes;
    _tblFKeys = tab.tblFKeys ?? _tblFKeys;
    const sql = _ddlMode === "edit-table" ? generateAlterSql() : generateDdlSql();
    if (!sql) { alert(_ddlMode === "edit-table" ? "No changes detected." : "Fill in table name and at least one column."); return; }
    applyBtn.disabled = true; applyBtn.textContent = "Executing…";
    try {
      await executeDdl(sql);
      // Close this tab after success
      closeTab(tab.id);
    } finally {
      applyBtn.disabled = false;
      applyBtn.textContent = tab.tblItem ? "Apply changes" : "Create table";
    }
  });
  topBar.appendChild(applyBtn);
  panel.appendChild(topBar);

  // ── Section tabs (Columns / Indexes / FK) ───────────────
  const tabBar = document.createElement("div");
  tabBar.className = "tbl-tabs";
  for (const [key, label] of [["columns","Columns"],["indexes","Indexes"],["fkeys","Foreign Keys"]]) {
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

  // ── Grid container ──────────────────────────────────────
  const gridWrap = document.createElement("div");
  gridWrap.id = "tblGrid"; gridWrap.className = "tbl-grid-wrap";
  panel.appendChild(gridWrap);

  // ── Toolbar ─────────────────────────────────────────────
  const toolbar = document.createElement("div");
  toolbar.className = "tbl-toolbar";
  const addRowBtn = document.createElement("button");
  addRowBtn.className = "tbl-toolbar-btn"; addRowBtn.id = "tblAddRowBtn";
  addRowBtn.textContent = "+ Add row";
  addRowBtn.addEventListener("click", () => {
    if (_tblTab === "columns") {
      _tblCols.push({ id: _uid(), name: "", type: _dbTypes()[0], notNull: false, pk: false, unique: false, default: "", original: null });
      tab.tblCols = _tblCols;
    } else if (_tblTab === "indexes") {
      _tblIndexes.push({ id: _uid(), name: "", columns: "", unique: false });
      tab.tblIndexes = _tblIndexes;
    } else {
      _tblFKeys.push({ id: _uid(), column: _tblCols[0]?.name ?? "", refTable: "", refColumn: "id", onDelete: "NO ACTION" });
      tab.tblFKeys = _tblFKeys;
    }
    renderTblGrid();
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll("#tblGrid .tg-input");
      inputs[inputs.length - 1]?.focus();
    });
  });
  toolbar.appendChild(addRowBtn);
  panel.appendChild(toolbar);

  // ── Load columns for edit mode ──────────────────────────
  if (tab.tblItem && !tab.loaded) {
    const loadEl = document.createElement("div");
    loadEl.className = "tbl-loading"; loadEl.textContent = "Loading columns…";
    gridWrap.appendChild(loadEl);
    try {
      const conn = activeConn();
      const res = await fetch("/api/columns", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: conn.type, connection: buildConnPayload(), schema: tab.tblItem.parent, table: tab.tblItem.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      _tblCols = data.columns.map(c => ({
        id: _uid(), name: c.name, type: c.dataType,
        notNull: !c.nullable, pk: c.isPrimary, unique: false, default: "", original: c.name,
      }));
      _ddlContext.originalCols = data.columns.map(c => ({ ...c }));
      tab.tblCols = _tblCols;
      tab.originalCols = _ddlContext.originalCols;
      tab.loaded = true;
    } catch (err) {
      gridWrap.textContent = "";
      const errEl = document.createElement("div");
      errEl.style.cssText = "padding:20px;color:var(--red);font-size:12px;";
      errEl.textContent = `Error: ${err.message}`; gridWrap.appendChild(errEl); return;
    }
  } else if (!tab.tblItem && !tab.loaded) {
    _tblCols = [
      { id: _uid(), name: "id", type: "serial", notNull: true, pk: true, unique: false, default: "", original: null },
      { id: _uid(), name: "created_at", type: "timestamptz", notNull: true, pk: false, unique: false, default: "now()", original: null },
    ];
    tab.tblCols = _tblCols;
    tab.loaded = true;
  }

  renderTblGrid();
  requestAnimationFrame(() => document.querySelector("#tblGrid .tg-input")?.focus());
}

function _syncTblToTab() {
  const tab = activeTab();
  if (!tab || tab.kind !== "table-editor") return;
  tab.tblCols = _tblCols;
  tab.tblIndexes = _tblIndexes;
  tab.tblFKeys = _tblFKeys;
  tab.tblTab = _tblTab;
}

// Default value presets by column type
const DEFAULT_PRESETS = {
  // auto-increment types — no DEFAULT needed
  serial: [], bigserial: [], smallserial: [],
  // uuid
  uuid: ["gen_random_uuid()", "uuid_generate_v4()", ""],
  // boolean
  boolean: ["true", "false", ""],
  // timestamps
  timestamp: ["now()", "CURRENT_TIMESTAMP", ""],
  timestamptz: ["now()", "CURRENT_TIMESTAMP", ""],
  datetime: ["CURRENT_TIMESTAMP", ""],
  // numeric
  integer: ["0", "1", ""], bigint: ["0", ""], smallint: ["0", ""], int: ["0", ""],
  float: ["0", ""], "double precision": ["0", ""], real: ["0", ""],
  "numeric(10,2)": ["0", ""], "decimal(10,2)": ["0", ""],
  // text
  text: ["''", ""], "varchar(255)": ["''", ""], "char(1)": ["''", ""],
  // json
  json: ["'{}'", "'[]'", ""], jsonb: ["'{}'", "'[]'", ""],
  // date
  date: ["CURRENT_DATE", ""],
};

// PK options: 0 = not PK, positive int = PK order in composite
function _pkOpts() {
  const maxOrder = Math.max(0, ..._tblCols.map(c => c.pkOrder ?? 0));
  const opts = [{ v: 0, label: "—" }];
  for (let i = 1; i <= maxOrder + 1; i++) opts.push({ v: i, label: `PK ${i}` });
  return opts;
}

function renderTblGrid() {
  const wrap = document.getElementById("tblGrid");
  if (!wrap) return;
  wrap.textContent = "";

  if (_tblTab === "columns") {
    const grid = document.createElement("div");
    grid.className = "tbl-grid";
    grid.style.gridTemplateColumns = "52px 1fr 160px 36px 36px minmax(120px, 220px) 28px";

    // Header
    for (const lbl of ["PK", "Name", "Type", "NN", "UQ", "Default", ""]) {
      const th = document.createElement("div");
      th.className = "tg-head"; th.textContent = lbl;
      grid.appendChild(th);
    }

    for (const row of _tblCols) {
      const isPk = (row.pkOrder ?? 0) > 0;

      // ── PK cell: select with order ──────────────────────
      const pkCell = document.createElement("div");
      pkCell.className = "tg-cell" + (isPk ? " tg-pk-row" : "");
      const pkSel = document.createElement("select");
      pkSel.className = "tg-select tg-pk-sel";
      for (const o of _pkOpts()) {
        const opt = document.createElement("option");
        opt.value = o.v; opt.textContent = o.label;
        if (o.v === (row.pkOrder ?? 0)) opt.selected = true;
        pkSel.appendChild(opt);
      }
      pkSel.addEventListener("change", () => {
        const r = _tblCols.find(r => r.id === row.id); if (!r) return;
        r.pkOrder = Number(pkSel.value);
        r.pk = r.pkOrder > 0;
        if (r.pk) r.notNull = true;
        _syncTblToTab(); renderTblGrid();
      });
      pkCell.appendChild(pkSel); grid.appendChild(pkCell);

      // ── Name ─────────────────────────────────────────────
      const nameCell = makeTgCell(isPk);
      const nameInp = document.createElement("input");
      nameInp.className = "tg-input"; nameInp.value = row.name ?? "";
      nameInp.placeholder = "column_name";
      nameInp.addEventListener("input", () => {
        const r = _tblCols.find(r => r.id === row.id); if (r) r.name = nameInp.value; _syncTblToTab();
      });
      nameInp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("tblAddRowBtn")?.click(); } });
      nameCell.appendChild(nameInp); grid.appendChild(nameCell);

      // ── Type ─────────────────────────────────────────────
      const typeCell = makeTgCell(isPk);
      const typeSel = document.createElement("select");
      typeSel.className = "tg-select";
      for (const t of _dbTypes()) {
        const opt = document.createElement("option"); opt.value = t; opt.textContent = t;
        if (t === row.type) opt.selected = true;
        typeSel.appendChild(opt);
      }
      typeSel.addEventListener("change", () => {
        const r = _tblCols.find(r => r.id === row.id); if (!r) return;
        r.type = typeSel.value;
        // reset default when type changes
        r.default = "";
        _syncTblToTab(); renderTblGrid();
      });
      typeCell.appendChild(typeSel); grid.appendChild(typeCell);

      // ── NN ────────────────────────────────────────────────
      const nnCell = makeTgCell(isPk, "center");
      const nnChk = document.createElement("input");
      nnChk.type = "checkbox"; nnChk.className = "tg-checkbox"; nnChk.checked = !!row.notNull;
      if (isPk) { nnChk.disabled = true; nnChk.title = "NOT NULL implied by PK"; }
      nnChk.addEventListener("change", () => {
        const r = _tblCols.find(r => r.id === row.id); if (r) { r.notNull = nnChk.checked; _syncTblToTab(); }
      });
      nnCell.appendChild(nnChk); grid.appendChild(nnCell);

      // ── UQ ────────────────────────────────────────────────
      const uqCell = makeTgCell(isPk, "center");
      const uqChk = document.createElement("input");
      uqChk.type = "checkbox"; uqChk.className = "tg-checkbox"; uqChk.checked = !!row.unique;
      uqChk.addEventListener("change", () => {
        const r = _tblCols.find(r => r.id === row.id); if (r) { r.unique = uqChk.checked; _syncTblToTab(); }
      });
      uqCell.appendChild(uqChk); grid.appendChild(uqCell);

      // ── Default (smart) ───────────────────────────────────
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
          const dfSel = document.createElement("select");
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
          if (!presets.includes(row.default ?? "")) {
            // current value is custom
            manualOpt.selected = true;
          }

          const dfInp = document.createElement("input");
          dfInp.className = "tg-input tg-default-inp";
          dfInp.value = row.default ?? "";
          dfInp.placeholder = "expression";
          dfInp.hidden = dfSel.value !== "__custom__";
          dfInp.addEventListener("input", () => {
            const r = _tblCols.find(r => r.id === row.id); if (r) { r.default = dfInp.value; _syncTblToTab(); }
          });

          dfSel.addEventListener("change", () => {
            if (dfSel.value === "__custom__") {
              dfInp.hidden = false; dfInp.focus();
            } else {
              dfInp.hidden = true;
              const r = _tblCols.find(r => r.id === row.id);
              if (r) { r.default = dfSel.value; _syncTblToTab(); }
            }
          });

          dfWrap.appendChild(dfSel);
          dfWrap.appendChild(dfInp);
        } else {
          // No presets — free text only
          const dfInp = document.createElement("input");
          dfInp.className = "tg-input"; dfInp.value = row.default ?? ""; dfInp.placeholder = "default value";
          dfInp.addEventListener("input", () => {
            const r = _tblCols.find(r => r.id === row.id); if (r) { r.default = dfInp.value; _syncTblToTab(); }
          });
          dfWrap.appendChild(dfInp);
        }
        dfCell.appendChild(dfWrap);
      }
      grid.appendChild(dfCell);

      // ── Delete ────────────────────────────────────────────
      const delCell = makeTgCell(isPk);
      const delBtn = document.createElement("button");
      delBtn.className = "tg-del-btn"; delBtn.textContent = "×"; delBtn.title = "Remove column";
      delBtn.addEventListener("click", () => {
        _tblCols = _tblCols.filter(r => r.id !== row.id); _syncTblToTab(); renderTblGrid();
      });
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
      ], _tblIndexes,
      (id, key, val) => { const r = _tblIndexes.find(r => r.id === id); if (r) { r[key] = val; _syncTblToTab(); } },
      id => { _tblIndexes = _tblIndexes.filter(r => r.id !== id); _syncTblToTab(); renderTblGrid(); }
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
      ], _tblFKeys,
      (id, key, val) => { const r = _tblFKeys.find(r => r.id === id); if (r) { r[key] = val; _syncTblToTab(); } },
      id => { _tblFKeys = _tblFKeys.filter(r => r.id !== id); _syncTblToTab(); renderTblGrid(); }
    );
  }
}

function makeTgCell(isPk, justify = "") {
  const cell = document.createElement("div");
  cell.className = "tg-cell" + (isPk ? " tg-pk-row" : "");
  if (justify) cell.style.justifyContent = justify;
  return cell;
}

function renderGrid(wrap, coldefs, rows, onChange, onDelete) {
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
        btn.addEventListener("click", () => onDelete(row.id));
        cell.appendChild(btn);
      } else if (col.type === "check") {
        cell.style.justifyContent = "center";
        const chk = document.createElement("input");
        chk.type = "checkbox"; chk.className = "tg-checkbox"; chk.checked = !!row[col.key];
        chk.addEventListener("change", () => onChange(row.id, col.key, chk.checked));
        cell.appendChild(chk);
      } else if (col.type === "select") {
        const sel = document.createElement("select"); sel.className = "tg-select";
        for (const o of (col.opts ?? [])) {
          const opt = document.createElement("option"); opt.value = o; opt.textContent = o;
          if (o === row[col.key]) opt.selected = true; sel.appendChild(opt);
        }
        sel.addEventListener("change", () => onChange(row.id, col.key, sel.value));
        cell.appendChild(sel);
      } else if (col.type === "combo") {
        const inp = document.createElement("input"); inp.className = "tg-input"; inp.value = row[col.key] ?? "";
        const dlId = "tg-dl-" + col.key; inp.setAttribute("list", dlId);
        const dl = document.createElement("datalist"); dl.id = dlId;
        for (const o of (col.opts ?? [])) { const opt = document.createElement("option"); opt.value = o; dl.appendChild(opt); }
        inp.addEventListener("input", () => onChange(row.id, col.key, inp.value));
        cell.appendChild(inp); cell.appendChild(dl);
      } else {
        const inp = document.createElement("input"); inp.className = "tg-input"; inp.value = row[col.key] ?? ""; inp.placeholder = col.label;
        inp.addEventListener("input", () => onChange(row.id, col.key, inp.value));
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

// Build column SQL definition string
function _colSql(c, pkCount, dbType) {
  const autoTypes = new Set(["serial","bigserial","smallserial"]);
  const nn = c.notNull && !autoTypes.has((c.type ?? "").toLowerCase()) ? " NOT NULL" : "";
  const uq = c.unique && !c.pk ? " UNIQUE" : "";
  // Don't emit DEFAULT for auto types or when empty
  const df = c.default && !autoTypes.has((c.type ?? "").toLowerCase()) ? ` DEFAULT ${c.default}` : "";
  // Inline PK only when single-column PK
  const pk = c.pk && pkCount === 1 ? " PRIMARY KEY" : "";
  return dbType === "mysql"
    ? `  \`${c.name}\` ${c.type}${nn}${uq}${df}${pk}`
    : `  ${_q(c.name)} ${c.type}${nn}${uq}${df}${pk}`;
}

function generateDdlSql() {
  if (_ddlMode === "schema") {
    const name = document.getElementById("ddlSchemaName")?.value.trim();
    if (!name) return null;
    return (activeConn()?.type ?? "postgres") === "mysql"
      ? `CREATE DATABASE IF NOT EXISTS \`${name}\`;`
      : `CREATE SCHEMA IF NOT EXISTS ${_q(name)};`;
  }

  if (_ddlMode === "table") {
    const schema = document.getElementById("tblSchemaInput")?.value;
    const name = document.getElementById("tblNameInput")?.value.trim();
    if (!name) return null;
    const cols = _tblCols.filter(c => c.name);
    if (!cols.length) return null;

    const dbType = activeConn()?.type ?? "postgres";
    // Sort PK cols by pkOrder for composite key
    const pkCols = cols.filter(c => c.pk).sort((a, b) => (a.pkOrder ?? 1) - (b.pkOrder ?? 1));
    const colDefs = cols.map(c => _colSql(c, pkCols.length, dbType));

    if (pkCols.length > 1)
      colDefs.push(`  PRIMARY KEY (${pkCols.map(c => dbType === "mysql" ? `\`${c.name}\`` : _q(c.name)).join(", ")})`);

    for (const fk of _tblFKeys.filter(f => f.column && f.refTable))
      colDefs.push(`  FOREIGN KEY (${_q(fk.column)}) REFERENCES ${_q(fk.refTable)} (${_q(fk.refColumn || "id")}) ON DELETE ${fk.onDelete}`);

    const ref = schema ? `${_q(schema)}.${_q(name)}` : _q(name);
    let sql = `CREATE TABLE IF NOT EXISTS ${ref} (\n${colDefs.join(",\n")}\n);`;

    for (const idx of _tblIndexes.filter(i => i.columns)) {
      const uq = idx.unique ? "UNIQUE " : "";
      const idxName = idx.name || `idx_${name}_${idx.columns.replace(/,\s*/g, "_")}`;
      const idxCols = idx.columns.split(",").map(c => _q(c.trim())).join(", ");
      sql += `\nCREATE ${uq}INDEX ${_q(idxName)} ON ${ref} (${idxCols});`;
    }
    return sql;
  }
  return null;
}

function generateAlterSql() {
  const item = _ddlContext?.item;
  if (!item) return null;
  const schema = document.getElementById("tblSchemaInput")?.value ?? item.parent;
  const newName = document.getElementById("tblNameInput")?.value.trim();
  const tableRef = schema ? `${_q(schema)}.${_q(item.name)}` : _q(item.name);
  const effectiveName = newName || item.name;
  const effectiveRef = schema ? `${_q(schema)}.${_q(effectiveName)}` : _q(effectiveName);
  const dbType = activeConn()?.type ?? "postgres";
  const stmts = [];

  if (newName && newName !== item.name)
    stmts.push(dbType === "mysql"
      ? `RENAME TABLE ${tableRef} TO ${_q(newName)};`
      : `ALTER TABLE ${tableRef} RENAME TO ${_q(newName)};`);

  const currentOriginals = new Set(_tblCols.map(c => c.original).filter(Boolean));

  for (const orig of (_ddlContext.originalCols ?? []))
    if (!currentOriginals.has(orig.name))
      stmts.push(`ALTER TABLE ${effectiveRef} DROP COLUMN ${_q(orig.name)};`);

  for (const col of _tblCols.filter(c => c.name)) {
    if (!col.original) {
      const autoTypes = new Set(["serial","bigserial","smallserial"]);
      const nn = col.notNull && !autoTypes.has((col.type ?? "").toLowerCase()) ? " NOT NULL" : "";
      const df = col.default && !autoTypes.has((col.type ?? "").toLowerCase()) ? ` DEFAULT ${col.default}` : "";
      stmts.push(`ALTER TABLE ${effectiveRef} ADD COLUMN ${_q(col.name)} ${col.type}${nn}${df};`);
    } else if (col.original !== col.name) {
      stmts.push(`ALTER TABLE ${effectiveRef} RENAME COLUMN ${_q(col.original)} TO ${_q(col.name)};`);
    }
  }

  for (const idx of _tblIndexes.filter(i => i.columns)) {
    const uq = idx.unique ? "UNIQUE " : "";
    const idxName = idx.name || `idx_${effectiveName}_${idx.columns.replace(/,\s*/g, "_")}`;
    const idxCols = idx.columns.split(",").map(c => _q(c.trim())).join(", ");
    stmts.push(`CREATE ${uq}INDEX ${_q(idxName)} ON ${effectiveRef} (${idxCols});`);
  }

  for (const fk of _tblFKeys.filter(f => f.column && f.refTable)) {
    const cn = `fk_${effectiveName}_${fk.column}`;
    stmts.push(`ALTER TABLE ${effectiveRef} ADD CONSTRAINT ${_q(cn)} FOREIGN KEY (${_q(fk.column)}) REFERENCES ${_q(fk.refTable)} (${_q(fk.refColumn || "id")}) ON DELETE ${fk.onDelete};`);
  }

  return stmts.length ? stmts.join("\n") : null;
}


// ─── Context Menu ──────────────────────────────────────────
function showCtxMenu(x, y, target) {
  _ctxTarget = target;
  const isSchema = target.type === "schema";
  const isTable = target.type === "table";
  el.ctxNewTable.textContent = isSchema ? `New Table in "${target.item.name}"` : "New Table here";
  el.ctxDropSchema.hidden = !isSchema;
  el.ctxEditTable.hidden = !isTable;
  el.ctxDropTable.hidden = isSchema;
  el.ctxTruncate.hidden = isSchema;

  el.ctxMenu.hidden = false;
  const mx = Math.min(x, window.innerWidth - 200);
  const my = Math.min(y, window.innerHeight - 120);
  el.ctxMenu.style.left = `${mx}px`;
  el.ctxMenu.style.top  = `${my}px`;
}

function hideCtxMenu() { el.ctxMenu.hidden = true; _ctxTarget = null; }

// ─── Event Listeners ──────────────────────────────────────

// Sidebar
el.sidebarCollapse.addEventListener("click", () => setSidebar(false));
el.sidebarShowBtn.addEventListener("click",  () => setSidebar(true));

// Theme
el.themeBtn.addEventListener("click", toggleTheme);

// Install
el.installBtn.addEventListener("click", async () => {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  await _deferredInstall.userChoice;
  _deferredInstall = null;
  el.installBtn.style.display = "none";
});

// Connections
el.newConnBtn.addEventListener("click",    () => openModal());
el.connPillChange.addEventListener("click", () => openModal());

// Schema
el.reloadSchema.addEventListener("click", loadSchema);
el.schemaSearch.addEventListener("input", renderSchemaTree);
el.newSchemaBtn.addEventListener("click", () => openDdlModal("schema"));
el.newTableBtn.addEventListener("click", () => openDdlModal("table"));

// DDL Modal
el.ddlModalClose.addEventListener("click", closeDdlModal);
el.ddlCancelBtn.addEventListener("click", closeDdlModal);
el.ddlModal.addEventListener("click", e => { if (e.target === el.ddlModal) closeDdlModal(); });
el.ddlGenerateBtn.addEventListener("click", async () => {
  const isEdit = _ddlMode === "edit-table";
  const sql = isEdit ? generateAlterSql() : generateDdlSql();
  if (!sql) { alert(isEdit ? "No changes detected." : "Please fill in required fields."); return; }
  const label = isEdit ? "Applying…" : "Creating…";
  el.ddlGenerateBtn.disabled = true;
  el.ddlGenerateBtn.textContent = label;
  try {
    await executeDdl(sql);
    closeDdlModal();
  } finally {
    el.ddlGenerateBtn.disabled = false;
    el.ddlGenerateBtn.textContent = isEdit ? "Apply" : "Create";
  }
});

// Context menu
el.ctxNewTable.addEventListener("click", () => {
  const ctx = _ctxTarget?.type === "schema" ? { schema: _ctxTarget.item.name } : {};
  hideCtxMenu();
  openDdlModal("table", ctx);
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
  openEditTableModal(item);
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

document.addEventListener("click", hideCtxMenu);
document.addEventListener("keydown", e => { if (e.key === "Escape") hideCtxMenu(); });

// Tabs
el.addTabBtn.addEventListener("click", () => createTab());

// Query toolbar
el.runBtn.addEventListener("click", runQuery);
el.explainBtn.addEventListener("click", runExplain);

// ─── Autocomplete ──────────────────────────────────────────
const SQL_KEYWORDS = [
  "SELECT","FROM","WHERE","INSERT","INTO","VALUES","UPDATE","SET","DELETE",
  "CREATE","TABLE","DROP","ALTER","ADD","COLUMN","INDEX","VIEW","FUNCTION",
  "JOIN","LEFT","RIGHT","INNER","OUTER","FULL","CROSS","ON","AS","AND","OR",
  "NOT","IN","IS","NULL","LIKE","BETWEEN","EXISTS","CASE","WHEN","THEN","ELSE",
  "END","ORDER","BY","GROUP","HAVING","LIMIT","OFFSET","DISTINCT","COUNT","SUM",
  "AVG","MIN","MAX","COALESCE","CAST","WITH","RETURNING","BEGIN","COMMIT",
  "ROLLBACK","EXPLAIN","ANALYZE","TRUNCATE","VACUUM","GRANT","REVOKE",
  "PRIMARY","KEY","FOREIGN","REFERENCES","UNIQUE","DEFAULT","NOT NULL",
  "IF","EXISTS","CASCADE","RESTRICT","SCHEMA","DATABASE","SHOW","USE",
];

let _acItems = [];
let _acIdx = -1;

function acGetPrefix() {
  const pos = el.editor.selectionStart;
  const before = el.editor.value.slice(0, pos);
  // Dot completion: schema.| or table.|
  const dotMatch = before.match(/(\w+)\.(\w*)$/);
  if (dotMatch) return { prefix: dotMatch[2], context: dotMatch[1], dot: true };
  const wordMatch = before.match(/(\w+)$/);
  return wordMatch ? { prefix: wordMatch[1], context: null, dot: false } : null;
}

function acBuildCandidates(prefix, context, dot) {
  const p = prefix.toLowerCase();
  const candidates = [];

  if (dot && context) {
    // After dot: show tables/objects in that schema
    const schemaItems = S.schemaItems.filter(i => i.parent === context && i.type !== "schema");
    for (const item of schemaItems) {
      if (!p || item.name.toLowerCase().startsWith(p))
        candidates.push({ label: item.name, kind: item.type });
    }
    return candidates;
  }

  if (!p || p.length < 1) return [];

  // Schema names
  for (const item of S.schemaItems.filter(i => i.type === "schema")) {
    if (item.name.toLowerCase().startsWith(p))
      candidates.push({ label: item.name, kind: "schema" });
  }
  // Tables/views/functions (show parent.name if ambiguous)
  const seen = new Set();
  for (const item of S.schemaItems.filter(i => i.type !== "schema")) {
    if (item.name.toLowerCase().startsWith(p) && !seen.has(item.name)) {
      candidates.push({ label: item.name, kind: item.type, detail: item.parent });
      seen.add(item.name);
    }
  }
  // SQL keywords
  for (const kw of SQL_KEYWORDS) {
    if (kw.toLowerCase().startsWith(p))
      candidates.push({ label: kw, kind: "keyword" });
  }

  return candidates.slice(0, 40);
}

function acShow(items, prefix) {
  _acItems = items;
  _acIdx = 0;
  el.acDropdown.textContent = "";

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = document.createElement("div");
    row.className = `ac-item${i === 0 ? " selected" : ""}`;
    row.setAttribute("role", "option");

    const kind = document.createElement("span");
    kind.className = `ac-item-kind ac-kind-${item.kind}`;
    kind.textContent = item.kind === "keyword" ? "kw" : item.kind.slice(0, 3);

    const label = document.createElement("span");
    label.className = "ac-item-label";
    label.textContent = item.label;

    row.appendChild(kind);
    row.appendChild(label);

    row.addEventListener("mousedown", e => {
      e.preventDefault();
      acApply(i);
    });
    el.acDropdown.appendChild(row);
  }

  // Position near cursor
  const coords = getCaretCoords();
  el.acDropdown.style.left = `${Math.min(coords.x, window.innerWidth - 380)}px`;
  el.acDropdown.style.top  = `${coords.y + 18}px`;
  el.acDropdown.hidden = false;
}

function acHide() {
  el.acDropdown.hidden = true;
  _acItems = [];
  _acIdx = -1;
}

function acSelect(delta) {
  if (!_acItems.length) return;
  const rows = el.acDropdown.querySelectorAll(".ac-item");
  rows[_acIdx]?.classList.remove("selected");
  _acIdx = (_acIdx + delta + _acItems.length) % _acItems.length;
  rows[_acIdx]?.classList.add("selected");
  rows[_acIdx]?.scrollIntoView({ block: "nearest" });
}

function acApply(idx) {
  if (idx === undefined) idx = _acIdx;
  if (idx < 0 || !_acItems[idx]) return;
  const item = _acItems[idx];
  const pos = el.editor.selectionStart;
  const v = el.editor.value;

  const m = acGetPrefix();
  if (!m) { acHide(); return; }

  const replaceStart = pos - (m.dot ? m.prefix.length : m.prefix.length);
  const insert = m.dot ? item.label : item.label;
  el.editor.value = v.slice(0, replaceStart) + insert + v.slice(pos);
  const newPos = replaceStart + insert.length;
  el.editor.selectionStart = el.editor.selectionEnd = newPos;
  updateGutter();
  updateHighlight();
  flushTabContent();
  acHide();
}

// Approximate caret position using a mirror div technique
function getCaretCoords() {
  const ta = el.editor;
  const style = window.getComputedStyle(ta);
  const mirror = document.createElement("div");
  mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;`;
  for (const p of ["font","fontSize","fontFamily","lineHeight","letterSpacing","padding","border","boxSizing","tabSize"]) {
    mirror.style[p] = style[p];
  }
  mirror.style.width = ta.offsetWidth + "px";
  document.body.appendChild(mirror);
  const before = document.createTextNode(ta.value.slice(0, ta.selectionStart));
  const caret = document.createElement("span");
  caret.textContent = "|";
  mirror.appendChild(before);
  mirror.appendChild(caret);
  const rect = ta.getBoundingClientRect();
  const caretRect = caret.getBoundingClientRect();
  document.body.removeChild(mirror);
  // caret is positioned within the mirror (which is hidden, so getBoundingClientRect may be 0)
  // Fallback: use textarea position + rough line/col estimate
  const lines = ta.value.slice(0, ta.selectionStart).split("\n");
  const lineH = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const col = lines[lines.length - 1].length;
  const charW = parseFloat(style.fontSize) * 0.6;
  return {
    x: rect.left + paddingLeft + col * charW,
    y: rect.top  + paddingTop  + (lines.length - 1) * lineH - ta.scrollTop,
  };
}

function acTrigger() {
  const m = acGetPrefix();
  if (!m || (m.prefix.length < 1 && !m.dot)) { acHide(); return; }
  const candidates = acBuildCandidates(m.prefix, m.context, m.dot);
  if (candidates.length) acShow(candidates, m.prefix);
  else acHide();
}

// Editor
el.editor.addEventListener("input", () => {
  updateGutter();
  updateHighlight();
  flushTabContent();
  acTrigger();
});

el.editor.addEventListener("scroll", syncScroll);

el.editor.addEventListener("keydown", e => {
  // Autocomplete navigation
  if (!el.acDropdown.hidden) {
    if (e.key === "ArrowDown")  { e.preventDefault(); acSelect(+1); return; }
    if (e.key === "ArrowUp")    { e.preventDefault(); acSelect(-1); return; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); acApply(); return; }
    if (e.key === "Escape")     { acHide(); return; }
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    runQuery();
  }
  if (e.key === "Tab" && el.acDropdown.hidden) {
    e.preventDefault();
    const s = el.editor.selectionStart;
    const v = el.editor.value;
    el.editor.value = `${v.slice(0, s)}  ${v.slice(el.editor.selectionEnd)}`;
    el.editor.selectionStart = el.editor.selectionEnd = s + 2;
    updateGutter();
    updateHighlight();
  }
  // Trigger on dot
  if (e.key === ".") {
    setTimeout(acTrigger, 0);
  }
});

el.editor.addEventListener("blur", () => setTimeout(acHide, 120));

// Results
el.exportCsvBtn.addEventListener("click", doExportCsv);
el.copyJsonBtn.addEventListener("click",  doCopyJson);

// Modal
el.connModalClose.addEventListener("click", closeModal);
el.connSaveBtn.addEventListener("click", saveConn);
el.connDeleteBtn.addEventListener("click", () => {
  if (!_editingConnId) return;
  S.connections = S.connections.filter(c => c.id !== _editingConnId);
  if (S.activeConnId === _editingConnId) S.activeConnId = null;
  save();
  renderConnectionList();
  updateToolbarPill();
  closeModal();
});

el.connModal.addEventListener("click", e => {
  if (e.target === el.connModal) closeModal();
});

el.mDbType.addEventListener("change", () => updateModalForType(el.mDbType.value));

el.connTestBtn.addEventListener("click", async () => {
  // Show testing state
  el.connTestResult.hidden = false;
  el.connTestResult.className = "conn-test-result testing";
  el.connTestIcon.textContent = "⏳";
  el.connTestMsg.textContent = "Testing connection…";
  el.connTestTime.textContent = "";
  el.connTestBtn.disabled = true;

  const t0 = Date.now();
  try {
    const result = await testConnPayload(modalPayload(), el.mDbType.value);
    const ms = Date.now() - t0;
    el.connTestResult.className = `conn-test-result ${result.ok ? "ok" : "error"}`;
    el.connTestIcon.textContent = result.ok ? "✓" : "✗";
    el.connTestMsg.textContent  = result.message || (result.ok ? "Connection successful" : "Connection failed");
    el.connTestTime.textContent = `${ms} ms`;
  } catch (err) {
    el.connTestResult.className = "conn-test-result error";
    el.connTestIcon.textContent = "✗";
    el.connTestMsg.textContent  = err.message || "Network error";
    el.connTestTime.textContent = "";
  } finally {
    el.connTestBtn.disabled = false;
  }
});

// Global keyboard shortcuts
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "t") { e.preventDefault(); createTab(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "w") { e.preventDefault(); if (S.activeTabId) closeTab(S.activeTabId); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") { e.preventDefault(); openModal(); }
  if (e.key === "F5") { e.preventDefault(); loadSchema(); }
  if (e.key === "Escape" && !el.connModal.hidden) closeModal();
});

// ─── Boot ─────────────────────────────────────────────────
load();
renderTabs();
renderConnectionList();
syncEditorFromTab();
updateToolbarPill();
updateGutter();
updateHighlight();
initResize();
setStatus("idle", "Ready");
if (activeConn()) loadSchema();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}
