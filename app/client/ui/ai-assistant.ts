import { S } from "../data/state";
import { getAiConfig, openSettings } from "./settings";
import type { AiConfig } from "../core/types";

function getEl<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

// ─── Panel toggle ─────────────────────────────────────────────

export function toggleAiPanel(): void {
  const app = getEl<HTMLElement>("app");
  const btn = getEl<HTMLElement>("aiBtn");
  const isOpen = app.classList.toggle("chat-open");
  btn.classList.toggle("ai-active", isOpen);
  if (isOpen) {
    renderChatState();
    getEl<HTMLTextAreaElement>("chatInput").focus();
  }
}

export function hideAiPanel(): void {
  getEl<HTMLElement>("app").classList.remove("chat-open");
  getEl<HTMLElement>("aiBtn").classList.remove("ai-active");
}

// ─── Schema context ───────────────────────────────────────────

function buildSchemaContext(): string {
  if (!S.schemaItems.length) return "";
  const bySchema = new Map<string, string[]>();
  for (const item of S.schemaItems) {
    if (item.type !== "table" && item.type !== "view" && item.type !== "matview") continue;
    const schema = item.parent ?? "public";
    if (!bySchema.has(schema)) bySchema.set(schema, []);
    const cols = S.columnCache.get(`${schema}.${item.name}`);
    const colStr = Array.isArray(cols)
      ? `(${cols.map(c => `${c.name} ${c.dataType}${c.isPrimary ? " PK" : ""}${!c.nullable ? " NOT NULL" : ""}`).join(", ")})`
      : "";
    bySchema.get(schema)!.push(`${item.name} ${colStr}`);
  }
  const lines: string[] = [];
  for (const [schema, tables] of bySchema) {
    lines.push(`Schema: ${schema}`);
    for (const t of tables) lines.push(`  - ${t}`);
  }
  return lines.join("\n");
}

function buildSystemPrompt(dbType: string): string {
  const schema = buildSchemaContext();
  const dialectHints: Record<string, string> = {
    postgres:   "Use PostgreSQL syntax.",
    mysql:      "Use MySQL syntax.",
    mongodb:    "Use MongoDB aggregation pipeline or find() syntax.",
    clickhouse: "Use ClickHouse SQL syntax.",
  };
  return [
    `You are an expert SQL assistant for ${dbType}.`,
    dialectHints[dbType] ?? "",
    "When the user asks for a query, return ONLY the SQL — no markdown fences, no explanation.",
    "When answering general questions, be concise.",
    schema ? `\nDatabase schema:\n${schema}` : "",
  ].filter(Boolean).join("\n");
}

// ─── LLM calls ───────────────────────────────────────────────

async function callOpenAICompat(cfg: AiConfig, messages: Array<{ role: string; content: string }>): Promise<string> {
  const base = cfg.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: cfg.model, messages, max_tokens: cfg.maxTokens }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content?.trim() ?? "";
}

async function callAnthropic(cfg: AiConfig, system: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: cfg.model, system, messages, max_tokens: cfg.maxTokens }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  return data.content.find(b => b.type === "text")?.text?.trim() ?? "";
}

// ─── Chat state ───────────────────────────────────────────────

type ChatMsg = { role: "user" | "ai"; content: string; isError?: boolean };
const history: ChatMsg[] = [];

function isConfigured(): boolean {
  const cfg = getAiConfig();
  return cfg.enabled && (!!cfg.apiKey || cfg.provider === "ollama");
}

function makePlaceholder(iconOpacity: string, text: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "chat-unconfigured";

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("width", "28"); icon.setAttribute("height", "28");
  icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor"); icon.setAttribute("stroke-width", "1.5");
  icon.setAttribute("aria-hidden", "true"); icon.style.opacity = iconOpacity;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
  icon.appendChild(path);

  const sub = document.createElement("p");
  sub.className = "chat-unconfigured-sub";
  sub.textContent = text;

  wrap.appendChild(icon);
  wrap.appendChild(sub);
  return wrap;
}

function renderChatState(): void {
  const messages = getEl<HTMLElement>("chatMessages");
  const ft = getEl<HTMLElement>("chatFt");

  if (!isConfigured()) {
    messages.replaceChildren();

    const wrap = document.createElement("div");
    wrap.className = "chat-unconfigured";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("width", "32"); icon.setAttribute("height", "32");
    icon.setAttribute("viewBox", "0 0 24 24"); icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor"); icon.setAttribute("stroke-width", "1.5");
    icon.setAttribute("aria-hidden", "true");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "10");
    const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l1.setAttribute("x1", "12"); l1.setAttribute("y1", "8"); l1.setAttribute("x2", "12"); l1.setAttribute("y2", "12");
    const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l2.setAttribute("x1", "12"); l2.setAttribute("y1", "16"); l2.setAttribute("x2", "12.01"); l2.setAttribute("y2", "16");
    icon.append(circle, l1, l2);

    const title = document.createElement("p");
    title.className = "chat-unconfigured-title";
    title.textContent = "AI not configured";

    const sub = document.createElement("p");
    sub.className = "chat-unconfigured-sub";
    sub.textContent = "Add an API key in Settings to use the AI assistant.";

    const btn = document.createElement("button");
    btn.className = "btn btn-primary btn-sm";
    btn.textContent = "Open Settings";
    btn.addEventListener("click", openSettings);

    wrap.append(icon, title, sub, btn);
    messages.appendChild(wrap);
    ft.hidden = true;
    return;
  }

  ft.hidden = false;
  if (!history.length) {
    messages.replaceChildren(makePlaceholder("0.3", "Ask a question or describe a query to generate SQL."));
  }
}

function appendMessage(msg: ChatMsg): void {
  const messages = getEl<HTMLElement>("chatMessages");
  if (messages.querySelector(".chat-unconfigured")) messages.replaceChildren();

  const wrap = document.createElement("div");
  wrap.className = `chat-msg chat-msg--${msg.isError ? "error" : msg.role}`;

  const role = document.createElement("div");
  role.className = "chat-msg-role";
  role.textContent = msg.role === "user" ? "You" : "AI";

  const body = document.createElement("div");
  body.className = "chat-msg-body";
  body.textContent = msg.content;

  wrap.append(role, body);

  const looksLikeSql = !msg.isError && msg.role === "ai" &&
    /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|EXPLAIN)\b/i.test(msg.content);

  if (looksLikeSql) {
    const actions = document.createElement("div");
    actions.className = "chat-msg-actions";
    const insertBtn = document.createElement("button");
    insertBtn.className = "chat-insert-btn";
    insertBtn.textContent = "Insert into editor";
    insertBtn.addEventListener("click", () => insertSqlIntoEditor(msg.content));
    actions.appendChild(insertBtn);
    wrap.appendChild(actions);
  }

  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
}

function insertSqlIntoEditor(sql: string): void {
  const editor = document.getElementById("editor") as HTMLTextAreaElement;
  const current = editor.value;
  const sep = current.trim() ? "\n\n" : "";
  editor.value = current + sep + sql;
  editor.dispatchEvent(new Event("input"));
  editor.scrollTop = editor.scrollHeight;
  editor.focus();
  const len = editor.value.length;
  editor.setSelectionRange(len, len);
}

// ─── Send ─────────────────────────────────────────────────────

async function sendMessage(text: string): Promise<void> {
  const cfg = getAiConfig();
  if (!cfg.enabled || (!cfg.apiKey && cfg.provider !== "ollama")) {
    renderChatState();
    return;
  }

  history.push({ role: "user", content: text });
  appendMessage({ role: "user", content: text });

  const conn = S.connections.find(c => c.id === S.activeConnId);
  const dbType = conn?.type ?? "postgres";
  const system = buildSystemPrompt(dbType);

  const apiMessages = history
    .filter(m => !m.isError)
    .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

  const sendBtn = getEl<HTMLElement>("chatSendBtn");
  const input   = getEl<HTMLTextAreaElement>("chatInput");
  sendBtn.setAttribute("disabled", "");
  input.setAttribute("disabled", "");

  try {
    let reply: string;
    if (cfg.provider === "anthropic") {
      reply = await callAnthropic(cfg, system, apiMessages);
    } else {
      reply = await callOpenAICompat(cfg, [{ role: "system", content: system }, ...apiMessages]);
    }
    history.push({ role: "ai", content: reply });
    appendMessage({ role: "ai", content: reply });
  } catch (err) {
    appendMessage({ role: "ai", content: err instanceof Error ? err.message : "Unknown error", isError: true });
  } finally {
    sendBtn.removeAttribute("disabled");
    input.removeAttribute("disabled");
    input.focus();
  }
}

// ─── Init ─────────────────────────────────────────────────────

export function initAiAssistant(): void {
  const aiBtn    = getEl<HTMLElement>("aiBtn");
  const closeBtn = getEl<HTMLElement>("chatClose");
  const sendBtn  = getEl<HTMLElement>("chatSendBtn");
  const input    = getEl<HTMLTextAreaElement>("chatInput");

  aiBtn.addEventListener("click", toggleAiPanel);
  closeBtn.addEventListener("click", hideAiPanel);

  sendBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sendMessage(text);
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      sendMessage(text);
    }
  });
}
