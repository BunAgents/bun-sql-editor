import { loadAiConfig, saveAiConfig, PROVIDER_DEFAULTS } from "../data/ai-config";
import type { AiConfig, AiProvider } from "../core/types";

let _cfg: AiConfig = loadAiConfig();

function getEl<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

export function openSettings(): void {
  const panel = getEl<HTMLElement>("settingsPanel");
  panel.hidden = false;
  renderSettingsForm();
}

export function closeSettings(): void {
  getEl<HTMLElement>("settingsPanel").hidden = true;
}

export function getAiConfig(): AiConfig {
  return _cfg;
}

function renderSettingsForm(): void {
  const provider = getEl<HTMLSelectElement>("sAiProvider");
  const apiKey   = getEl<HTMLInputElement>("sAiKey");
  const model    = getEl<HTMLInputElement>("sAiModel");
  const baseUrl  = getEl<HTMLInputElement>("sAiBaseUrl");
  const maxToks  = getEl<HTMLInputElement>("sAiMaxTokens");
  const enabled  = getEl<HTMLInputElement>("sAiEnabled");

  provider.value = _cfg.provider;
  apiKey.value   = _cfg.apiKey;
  model.value    = _cfg.model;
  baseUrl.value  = _cfg.baseUrl || (PROVIDER_DEFAULTS[_cfg.provider]?.baseUrl ?? "");
  maxToks.value  = String(_cfg.maxTokens);
  enabled.checked = _cfg.enabled;

  updateProviderHints(_cfg.provider);
}

function updateProviderHints(provider: string): void {
  const baseUrlField = getEl<HTMLElement>("sAiBaseUrlField");
  const apiKeyField  = getEl<HTMLElement>("sAiKeyField");
  const baseUrl      = getEl<HTMLInputElement>("sAiBaseUrl");
  const model        = getEl<HTMLInputElement>("sAiModel");

  const defs = PROVIDER_DEFAULTS[provider];

  // Ollama: no API key needed
  apiKeyField.style.opacity = provider === "ollama" ? "0.4" : "";
  getEl<HTMLInputElement>("sAiKey").placeholder = provider === "ollama" ? "not required" : "sk-...";

  // Base URL: always visible, prefill with known defaults
  if (!model.value || model.dataset.provider !== provider) {
    model.value = defs?.model ?? "";
    model.dataset.provider = provider;
  }
  if (!baseUrl.dataset.edited || baseUrl.dataset.provider !== provider) {
    baseUrl.value = defs?.baseUrl ?? "";
    baseUrl.dataset.provider = provider;
  }

  // Show base URL hint for custom provider
  const hint = baseUrlField.querySelector(".field-hint") as HTMLElement | null;
  if (hint) hint.hidden = provider !== "custom";
}

export function initSettings(): void {
  const panel    = getEl<HTMLElement>("settingsPanel");
  const closeBtn = getEl<HTMLElement>("settingsClose");
  const provider = getEl<HTMLSelectElement>("sAiProvider");
  const baseUrl  = getEl<HTMLInputElement>("sAiBaseUrl");
  const saveBtn  = getEl<HTMLElement>("sAiSave");

  closeBtn.addEventListener("click", closeSettings);
  panel.addEventListener("click", e => { if (e.target === panel) closeSettings(); });

  provider.addEventListener("change", () => {
    baseUrl.dataset.edited = "";
    baseUrl.dataset.provider = "";
    updateProviderHints(provider.value);
  });

  baseUrl.addEventListener("input", () => {
    baseUrl.dataset.edited = "1";
  });

  saveBtn.addEventListener("click", () => {
    const cfg: AiConfig = {
      provider:  provider.value as AiProvider,
      apiKey:    getEl<HTMLInputElement>("sAiKey").value.trim(),
      model:     getEl<HTMLInputElement>("sAiModel").value.trim(),
      baseUrl:   baseUrl.value.trim() || (PROVIDER_DEFAULTS[provider.value]?.baseUrl ?? ""),
      maxTokens: parseInt(getEl<HTMLInputElement>("sAiMaxTokens").value, 10) || 2048,
      enabled:   getEl<HTMLInputElement>("sAiEnabled").checked,
    };
    _cfg = cfg;
    saveAiConfig(cfg);

    const status = getEl<HTMLElement>("sAiSaveStatus");
    status.textContent = "Saved";
    status.hidden = false;
    setTimeout(() => { status.hidden = true; }, 1500);
  });
}
