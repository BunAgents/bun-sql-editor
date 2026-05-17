import { el } from "./dom";
import { S, activeTab } from "../data/state";
import { save } from "../data/persistence";
import { clearResults } from "./results";
import { updateGutter, updateHighlight } from "./editor";
import { mountTableEditorTab } from "./ddl";
import { mountErdTab } from "./erd";

export const DB_BADGE: Record<string, string> = { postgres: "PG", mysql: "MY", mongodb: "MG", clickhouse: "CH" };

export function createTab(persist = true): void {
  const tab = activeTab();
  const id = `tab-${Date.now()}`;
  S.tabs.push({
    id,
    title: `Query ${S.tabs.length + 1}`,
    content: "",
    dbType: (tab as { dbType?: "postgres" | "mysql" | "mongodb" | "clickhouse" })?.dbType ?? "postgres",
    connId: S.activeConnId,
  });
  S.activeTabId = id;
  if (persist) save();
  renderTabs();
  syncEditorFromTab();
}

export function closeTab(id: string): void {
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

export function switchTab(id: string): void {
  flushTabContent();
  S.activeTabId = id;
  save();
  renderTabs();
  syncEditorFromTab();
}

export function flushTabContent(): void {
  const tab = activeTab();
  if (tab && !tab.kind) {
    tab.content = el.editor.value;
    tab.connId  = S.activeConnId;
  }
}

export function syncEditorFromTab(): void {
  const tab = activeTab();
  const isTblEditor = tab?.kind === "table-editor";
  const isErd       = tab?.kind === "erd";

  el.workspace.hidden           = isTblEditor || isErd;
  el.tableEditorPanel.hidden    = !isTblEditor;
  el.erdPanel.hidden            = !isErd;
  if (el.queryToolbar) el.queryToolbar.hidden = isErd ?? false;

  if (isTblEditor && tab?.kind === "table-editor") { mountTableEditorTab(tab); return; }
  if (isErd && tab?.kind === "erd")                { mountErdTab(tab); return; }

  el.editor.value = (tab as { content?: string })?.content ?? "";
  if (tab?.connId && tab.connId !== S.activeConnId) {
    S.activeConnId = tab.connId;
    import("./connections").then(m => { m.updateToolbarPill(); m.renderConnectionList(); });
  }
  updateGutter();
  updateHighlight();
  clearResults();
}

export function renderTabs(): void {
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
    } else if (tab.kind === "erd") {
      badge.className = "tab-badge tab-badge--erd";
      badge.textContent = "ERD";
    } else {
      const dbType = (tab as { dbType?: string }).dbType ?? "postgres";
      badge.className = `tab-badge ${dbType}`;
      badge.textContent = DB_BADGE[dbType] ?? "DB";
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
