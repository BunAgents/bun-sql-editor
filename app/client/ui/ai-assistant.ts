import { S } from "../data/state";
import { getAiConfig, openSettings } from "./settings";
import type { AiConfig } from "../core/types";

function getEl<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

export function toggleAiBar(): void {
  const bar = getEl<HTMLElement>("aiPromptBar");
  const hidden = bar.hidden;
  bar.hidden = !hidden;
  if (!hidden) return;
  getEl<HTMLInputElement>("aiPromptInput").focus();
}

export function hideAiBar(): void {
  getEl<HTMLElement>("aiPromptBar").hidden = true;
}

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
    postgres:   "Use PostgreSQL syntax. Use $1, $2 for parameterized queries.",
    mysql:      "Use MySQL syntax. Use ? for parameterized queries.",
    mongodb:    "Use MongoDB aggregation pipeline or find() syntax.",
    clickhouse: "Use ClickHouse SQL syntax.",
  };

  return [
    `You are an expert SQL assistant for ${dbType}.`,
    dialectHints[dbType] ?? "",
    "Return ONLY the SQL query, no explanations, no markdown fences.",
    schema ? `\nDatabase schema:\n${schema}` : "",
  ].filter(Boolean).join("\n");
}

async function callOpenAICompat(cfg: AiConfig, systemPrompt: string, userPrompt: string): Promise<string> {
  const base = cfg.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      max_tokens: cfg.maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content?.trim() ?? "";
}

async function callAnthropic(cfg: AiConfig, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: cfg.model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: cfg.maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  return data.content.find(b => b.type === "text")?.text?.trim() ?? "";
}

async function generateSql(prompt: string, dbType: string): Promise<string> {
  const cfg = getAiConfig();
  if (!cfg.enabled) { openSettings(); throw new Error("Enable AI in Settings first."); }
  if (!cfg.apiKey && cfg.provider !== "ollama") { openSettings(); throw new Error("Enter your API key in Settings."); }

  const systemPrompt = buildSystemPrompt(dbType);

  if (cfg.provider === "anthropic") {
    return callAnthropic(cfg, systemPrompt, prompt);
  }
  return callOpenAICompat(cfg, systemPrompt, prompt);
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

export function initAiAssistant(): void {
  const sendBtn   = getEl<HTMLElement>("aiSendBtn");
  const promptIn  = getEl<HTMLInputElement>("aiPromptInput");
  const statusEl  = getEl<HTMLElement>("aiStatus");
  const aiBtn     = getEl<HTMLElement>("aiBtn");

  aiBtn.addEventListener("click", toggleAiBar);

  async function doGenerate() {
    const text = promptIn.value.trim();
    if (!text) return;

    const conn = S.connections.find(c => c.id === S.activeConnId);
    const dbType = conn?.type ?? "postgres";

    sendBtn.setAttribute("disabled", "");
    statusEl.textContent = "Generating…";
    statusEl.hidden = false;

    try {
      const sql = await generateSql(text, dbType);
      insertSqlIntoEditor(sql);
      promptIn.value = "";
      statusEl.hidden = true;
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : "Unknown error";
    } finally {
      sendBtn.removeAttribute("disabled");
    }
  }

  sendBtn.addEventListener("click", doGenerate);
  promptIn.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doGenerate(); }
    if (e.key === "Escape") hideAiBar();
  });
}
