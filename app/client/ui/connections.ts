import { el } from "./dom";
import { S, activeConn } from "../data/state";
import { save } from "../data/persistence";
import { setStatus } from "./status";
import { apiTest } from "../data/api";
import { loadSchema } from "./schema";
import type { Connection } from "../core/types";

const DB_BADGE: Record<string, string> = { postgres: "PG", mysql: "MY", mongodb: "MG", clickhouse: "CH" };

export function updateToolbarPill(): void {
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

export function renderConnectionList(): void {
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

export function activateConn(id: string): void {
  S.activeConnId = id;
  const tab = S.tabs.find(t => t.id === S.activeTabId);
  if (tab) tab.connId = id;
  save();
  renderConnectionList();
  updateToolbarPill();
  loadSchema();
}

// ─── Connection Modal ──────────────────────────────────────
const MODAL_DEFAULTS: Record<string, { host: string; port: string; user: string; db: string }> = {
  postgres:   { host: "localhost", port: "5432",  user: "postgres", db: "" },
  mysql:      { host: "localhost", port: "3306",  user: "root",     db: "" },
  mongodb:    { host: "mongodb://localhost:27017", port: "", user: "", db: "" },
  clickhouse: { host: "http://localhost:8123",     port: "", user: "default", db: "" },
};

let _editingConnId: string | null = null;

export function openModal(connId: string | null = null): void {
  _editingConnId = connId;
  const conn = connId ? S.connections.find(c => c.id === connId) : null;

  el.connModal.hidden = false;
  el.connModal.removeAttribute("hidden");
  el.connModal.querySelector(".modal-title")!.textContent = conn ? "Edit Connection" : "New Connection";
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
  el.connTestIcon.textContent = "";
  el.connTestMsg.textContent  = "";
  el.connTestTime.textContent = "";

  updateModalForType(el.mDbType.value, !!conn);
  renderModalSavedList();
  requestAnimationFrame(() => el.mConnName.focus());
}

export function closeModal(): void {
  el.connModal.hidden = true;
  _editingConnId = null;
}

export function updateModalForType(type: string, preserveValues = false): void {
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

function renderModalSavedList(): void {
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

export function modalPayload(): Record<string, unknown> {
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

export async function saveConn(): Promise<void> {
  const type = el.mDbType.value as Connection["type"];
  const name = el.mConnName.value.trim() || `${type}-${el.mDatabase.value || "default"}`;
  const payload = modalPayload();

  const conn: Connection = {
    id:       _editingConnId || `conn-${Date.now()}`,
    name, type,
    host:     (payload.host as string) ?? "",
    uri:      (payload.uri as string) ?? "",
    port:     payload.port as number | undefined,
    user:     (payload.user as string) ?? "",
    password: (payload.password as string) ?? "",
    database: (payload.database as string) ?? "",
    ssl:      (payload.ssl as boolean) ?? false,
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

export async function testConn(): Promise<void> {
  el.connTestResult.hidden = false;
  el.connTestResult.className = "conn-test-result testing";
  el.connTestIcon.textContent = "⏳";
  el.connTestMsg.textContent = "Testing connection…";
  el.connTestTime.textContent = "";
  el.connTestBtn.disabled = true;

  const t0 = Date.now();
  try {
    const result = await apiTest(modalPayload(), el.mDbType.value);
    const ms = Date.now() - t0;
    const ok = result.ok as boolean;
    el.connTestResult.className = `conn-test-result ${ok ? "ok" : "error"}`;
    el.connTestIcon.textContent = ok ? "✓" : "✗";
    el.connTestMsg.textContent  = (result.message as string) || (ok ? "Connection successful" : "Connection failed");
    el.connTestTime.textContent = `${ms} ms`;
  } catch (err) {
    el.connTestResult.className = "conn-test-result error";
    el.connTestIcon.textContent = "✗";
    el.connTestMsg.textContent  = (err as Error).message || "Network error";
    el.connTestTime.textContent = "";
  } finally {
    el.connTestBtn.disabled = false;
  }
}

export function deleteConn(): void {
  if (!_editingConnId) return;
  S.connections = S.connections.filter(c => c.id !== _editingConnId);
  if (S.activeConnId === _editingConnId) S.activeConnId = null;
  save();
  renderConnectionList();
  updateToolbarPill();
  closeModal();
}
