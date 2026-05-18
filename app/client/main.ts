import { S } from "./data/state";
import { el } from "./ui/dom";
import { loadPersistedState, save } from "./data/persistence";
import { applyTheme, toggleTheme } from "./ui/theme";
import { setStatus } from "./ui/status";
import { updateGutter, updateHighlight, syncScroll, initResize } from "./ui/editor";
import { sqlFormat } from "./core/formatter";
import { renderTabs, createTab, closeTab, flushTabContent } from "./ui/tabs";
import { renderConnectionList, updateToolbarPill, openModal, closeModal, saveConn, deleteConn, updateModalForType, modalPayload, testConn, activateConn } from "./ui/connections";
import { loadSchema, renderSchemaTree } from "./ui/schema";
import { runQuery, runExplain } from "./ui/query";
import { doExportCsv, doCopyJson } from "./ui/results";
import { toggleHistory } from "./ui/history";
import { openDdlModal, closeDdlModal, initDdlModal } from "./ui/ddl";
import { initContextMenu } from "./ui/contextmenu";
import { lockScreen, initLock } from "./ui/lock";
import { acHide, acSelect, acApply, acTrigger } from "./ui/autocomplete";
import { initSettings, openSettings } from "./ui/settings";
import { initAiAssistant } from "./ui/ai-assistant";

// ─── Boot ────────────────────────────────────────────────────
const { theme } = loadPersistedState();
applyTheme(theme, false);
if (!S.tabs.length) createTab(false);

renderTabs();
renderConnectionList();
updateToolbarPill();
updateGutter();
updateHighlight();
initResize();
initDdlModal();
initContextMenu();
initLock();
initSettings();
initAiAssistant();
setStatus("idle", "Ready");
if (S.activeConnId) loadSchema();

// ─── PWA ─────────────────────────────────────────────────────
let _deferredInstall: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

window.addEventListener("beforeinstallprompt", (e: Event) => {
  e.preventDefault();
  _deferredInstall = e as BeforeInstallPromptEvent;
  el.installBtn.style.display = "";
});

window.addEventListener("appinstalled", () => {
  el.installBtn.style.display = "none";
  _deferredInstall = null;
  setStatus("ok", "App installed!");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

// ─── Sidebar ─────────────────────────────────────────────────
function setSidebar(open: boolean): void {
  S.sidebarOpen = open;
  el.app.classList.toggle("sidebar-hidden", !open);
  el.sidebarShowBtn.style.display = open ? "none" : "";
  localStorage.setItem("qf_sidebar", open ? "1" : "0");
}

const sidebarPref = localStorage.getItem("qf_sidebar");
if (sidebarPref === "0") setSidebar(false);

el.sidebarCollapse.addEventListener("click", () => setSidebar(false));
el.sidebarShowBtn.addEventListener("click",  () => setSidebar(true));

// ─── Theme ───────────────────────────────────────────────────
el.themeBtn.addEventListener("click", toggleTheme);

// ─── Install ─────────────────────────────────────────────────
el.installBtn.addEventListener("click", async () => {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  await _deferredInstall.userChoice;
  _deferredInstall = null;
  el.installBtn.style.display = "none";
});

// ─── Connections ─────────────────────────────────────────────
el.newConnBtn.addEventListener("click",    () => openModal());
el.connPillChange.addEventListener("click", () => openModal());
el.connModalClose.addEventListener("click", closeModal);
el.connSaveBtn.addEventListener("click", saveConn);
el.connDeleteBtn.addEventListener("click", deleteConn);
el.connModal.addEventListener("click", e => { if (e.target === el.connModal) closeModal(); });
el.mDbType.addEventListener("change", () => updateModalForType(el.mDbType.value));
el.connTestBtn.addEventListener("click", testConn);

// ─── Schema ──────────────────────────────────────────────────
el.reloadSchema.addEventListener("click", loadSchema);
el.schemaSearch.addEventListener("input", renderSchemaTree);
el.newSchemaBtn.addEventListener("click", () => openDdlModal("schema"));
el.newTableBtn.addEventListener("click", () => openDdlModal("table"));

// ─── Tabs ────────────────────────────────────────────────────
el.addTabBtn.addEventListener("click", () => createTab());

// ─── Query toolbar ───────────────────────────────────────────
el.runBtn.addEventListener("click", runQuery);
el.explainBtn.addEventListener("click", runExplain);
el.formatBtn.addEventListener("click", () => {
  const sql = el.editor.value;
  if (!sql.trim()) return;
  el.editor.value = sqlFormat(sql);
  flushTabContent();
  save();
  updateGutter();
  updateHighlight();
});
el.historyBtn.addEventListener("click", toggleHistory);
el.qhistClose.addEventListener("click", () => { el.qhistPanel.hidden = true; });
el.qhistClear.addEventListener("click", () => {
  S.queryHistory = [];
  save();
  import("./ui/history").then(m => m.renderQueryHistory());
});

// ─── Results ─────────────────────────────────────────────────
el.exportCsvBtn.addEventListener("click", doExportCsv);
el.copyJsonBtn.addEventListener("click",  doCopyJson);

// ─── Editor events ───────────────────────────────────────────
el.editor.addEventListener("input", () => {
  updateGutter();
  updateHighlight();
  flushTabContent();
  acTrigger();
});
el.editor.addEventListener("scroll", syncScroll);
el.editor.addEventListener("keydown", e => {
  if (!el.acDropdown.hidden) {
    if (e.key === "ArrowDown") { e.preventDefault(); acSelect(+1); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); acSelect(-1); return; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); acApply(); return; }
    if (e.key === "Escape") { acHide(); return; }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runQuery(); }
  if (e.key === "Tab" && el.acDropdown.hidden) {
    e.preventDefault();
    const s = el.editor.selectionStart;
    const v = el.editor.value;
    el.editor.value = `${v.slice(0, s)}  ${v.slice(el.editor.selectionEnd)}`;
    el.editor.selectionStart = el.editor.selectionEnd = s + 2;
    updateGutter();
    updateHighlight();
  }
  if (e.key === ".") setTimeout(acTrigger, 0);
});
el.editor.addEventListener("blur", () => setTimeout(acHide, 120));

// ─── Settings ────────────────────────────────────────────────
el.settingsBtn.addEventListener("click", openSettings);

// ─── Global keyboard shortcuts ───────────────────────────────
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "t") { e.preventDefault(); createTab(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "w") { e.preventDefault(); if (S.activeTabId) closeTab(S.activeTabId); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") { e.preventDefault(); openModal(); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") { e.preventDefault(); el.formatBtn.click(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "h") { e.preventDefault(); toggleHistory(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "l") { e.preventDefault(); lockScreen(); }
  if (e.key === "F5") { e.preventDefault(); loadSchema(); }
  if (e.key === "Escape" && !el.connModal.hidden) closeModal();
});
