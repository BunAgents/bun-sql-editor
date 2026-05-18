import type { AiConfig } from "../core/types";

const KEY = "qf_ai_config";

const DEFAULTS: AiConfig = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o",
  baseUrl: "",
  maxTokens: 2048,
  enabled: true,
};

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function saveAiConfig(cfg: AiConfig): void {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  openai:     { baseUrl: "https://api.openai.com/v1",         model: "gpt-4o" },
  anthropic:  { baseUrl: "https://api.anthropic.com",         model: "claude-sonnet-4-6" },
  ollama:     { baseUrl: "http://localhost:11434/v1",          model: "llama3" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1",      model: "openai/gpt-4o" },
  fastrouter: { baseUrl: "https://fastrouter.ai/v1",          model: "gpt-4o" },
  custom:     { baseUrl: "",                                   model: "" },
};
