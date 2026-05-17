import { el } from "./dom";
import { tokenize } from "../core/tokenizer";
export { tokenize } from "../core/tokenizer";
export type { Token } from "../core/tokenizer";

export function updateHighlight(): void {
  el.hlLayer.textContent = "";
  const frag = document.createDocumentFragment();
  for (const tok of tokenize(el.editor.value)) {
    if (tok.t === "text") {
      frag.appendChild(document.createTextNode(tok.v));
    } else {
      const span = document.createElement("span");
      span.className = `tok-${tok.t}`;
      span.textContent = tok.v;
      frag.appendChild(span);
    }
  }
  frag.appendChild(document.createTextNode("\n"));
  el.hlLayer.appendChild(frag);
}

export function updateGutter(): void {
  const n = (el.editor.value.match(/\n/g) || []).length + 1;
  const cur = el.gutter.children.length;
  if (n > cur) {
    for (let i = cur + 1; i <= n; i++) {
      const span = document.createElement("span");
      span.textContent = String(i);
      el.gutter.appendChild(span);
    }
  } else {
    while (el.gutter.children.length > n) el.gutter.removeChild(el.gutter.lastChild!);
  }
}

export function syncScroll(): void {
  el.gutter.scrollTop   = el.editor.scrollTop;
  el.hlLayer.scrollTop  = el.editor.scrollTop;
  el.hlLayer.scrollLeft = el.editor.scrollLeft;
}

export function initResize(): void {
  let drag = false, startY = 0, startH = 0;

  el.divider.addEventListener("mousedown", e => {
    drag = true;
    startY = (e as MouseEvent).clientY;
    startH = el.editorPanel.offsetHeight;
    el.divider.classList.add("dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
  });

  el.divider.addEventListener("keydown", e => {
    const ke = e as KeyboardEvent;
    const step = ke.shiftKey ? 50 : 20;
    const cur = el.editorPanel.offsetHeight;
    const parent = (el.editorPanel.parentElement as HTMLElement).offsetHeight;
    if (ke.key === "ArrowUp")   setEditorHeight(Math.max(80, cur - step), parent);
    if (ke.key === "ArrowDown") setEditorHeight(Math.min(parent - 80, cur + step), parent);
  });

  document.addEventListener("mousemove", e => {
    if (!drag) return;
    const parent = (el.editorPanel.parentElement as HTMLElement).offsetHeight;
    setEditorHeight(startH + ((e as MouseEvent).clientY - startY), parent);
  });

  document.addEventListener("mouseup", () => {
    if (!drag) return;
    drag = false;
    el.divider.classList.remove("dragging");
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  });
}

function setEditorHeight(h: number, parentH: number): void {
  const clamped = Math.max(80, Math.min(h, parentH - 80 - el.divider.offsetHeight));
  el.editorPanel.style.flex = "none";
  el.editorPanel.style.height = `${clamped}px`;
  el.resultsPanel.style.flex = "1 1 0";
  syncScroll();
}
