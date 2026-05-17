import { el } from "./dom";

export type StatusState = "idle" | "loading" | "ok" | "error";

export function setStatus(state: StatusState, msg: string): void {
  el.statusIndicator.dataset.state = state;
  el.statusText.textContent = msg;
}
