import { el } from "./dom";
import { save } from "../data/persistence";

const THEME_COLORS: Record<string, string> = { dark: "#1e1e1e", light: "#f6f8fa" };

export function applyTheme(theme: string, persist = true): void {
  document.documentElement.dataset.theme = theme;
  (el.themeColorMeta as HTMLMetaElement).content = THEME_COLORS[theme] ?? THEME_COLORS.dark;
  if (persist) save();
}

export function toggleTheme(): void {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
}
