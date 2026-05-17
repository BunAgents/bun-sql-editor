import { S } from "./state";
import type { Tab } from "../core/types";

export function save(): void {
  const tabsToSave: Tab[] = S.tabs.map(t =>
    t.kind === "erd" ? { ...t, erdData: null } : t
  );
  localStorage.setItem("qf_tabs",  JSON.stringify({ tabs: tabsToSave, activeTabId: S.activeTabId }));
  localStorage.setItem("qf_conns", JSON.stringify(S.connections));
  localStorage.setItem("qf_theme", document.documentElement.dataset.theme ?? "dark");
  localStorage.setItem("qf_hist",  JSON.stringify(S.queryHistory.slice(0, 200)));
}

export function loadPersistedState(): { theme: string } {
  const theme = localStorage.getItem("qf_theme") ?? "dark";

  try {
    S.connections = JSON.parse(localStorage.getItem("qf_conns") || "[]");
  } catch {}

  try {
    const d = JSON.parse(localStorage.getItem("qf_tabs") || "{}");
    if (Array.isArray(d.tabs) && d.tabs.length) {
      S.tabs = d.tabs;
      S.activeTabId = d.activeTabId || d.tabs[0].id;
    }
  } catch {}

  try {
    S.queryHistory = JSON.parse(localStorage.getItem("qf_hist") || "[]");
  } catch {}

  return { theme };
}
