import { el } from "./dom";
import { S } from "../data/state";
import { save } from "../data/persistence";
import { makeSvgIcon, svgEl } from "./svg";
import { openTableEditor } from "./ddl";
import { renderTabs, switchTab, flushTabContent } from "./tabs";
import { syncEditorFromTab } from "./tabs";
import type { ErdTab, ErdTable, FkRelation, ColumnInfo } from "../core/types";

const CARD_W = 220, CARD_H_BASE = 38, COL_H = 24, GRID_COLS = 4, GAP = 40;

export function openErdTab(schema: string): void {
  const existing = S.tabs.find(t => t.kind === "erd" && (t as ErdTab).erdSchema === schema && t.connId === S.activeConnId);
  if (existing) { switchTab(existing.id); return; }
  flushTabContent();
  const id = `tab-erd-${Date.now()}`;
  const conn = S.connections.find(c => c.id === S.activeConnId);
  S.tabs.push({
    id,
    kind: "erd",
    title: `ERD: ${schema}`,
    content: "",
    dbType: conn?.type ?? "postgres",
    connId: S.activeConnId,
    erdSchema: schema,
    erdData: null,
    erdPositions: {},
    erdZoom: 1,
    erdPan: { x: 0, y: 0 },
  });
  S.activeTabId = id;
  save();
  renderTabs();
  syncEditorFromTab();
}

export async function mountErdTab(tab: ErdTab): Promise<void> {
  const panel = el.erdPanel;
  panel.textContent = "";

  const toolbar = document.createElement("div");
  toolbar.className = "erd-toolbar";

  const title = document.createElement("span");
  title.className = "erd-toolbar-title";
  title.textContent = tab.erdSchema;

  const fitBtn = document.createElement("button");
  fitBtn.className = "erd-toolbar-btn"; fitBtn.textContent = "Fit";

  const zoomInBtn = document.createElement("button");
  zoomInBtn.className = "erd-toolbar-btn"; zoomInBtn.textContent = "+";

  const zoomOutBtn = document.createElement("button");
  zoomOutBtn.className = "erd-toolbar-btn"; zoomOutBtn.textContent = "−";

  const reloadBtn = document.createElement("button");
  reloadBtn.className = "erd-toolbar-btn"; reloadBtn.textContent = "↺ Reload";
  reloadBtn.addEventListener("click", async () => { tab.erdData = null; tab.erdPositions = {}; await mountErdTab(tab); });

  toolbar.appendChild(title);
  toolbar.appendChild(fitBtn);
  toolbar.appendChild(zoomInBtn);
  toolbar.appendChild(zoomOutBtn);
  toolbar.appendChild(reloadBtn);
  panel.appendChild(toolbar);

  const canvasWrap = document.createElement("div");
  canvasWrap.className = "erd-canvas-wrap";
  panel.appendChild(canvasWrap);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement & { _erdRelations?: FkRelation[]; _erdCardEls?: Record<string, CardEl>; _erdWrap?: Element };
  svg.setAttribute("class", "erd-svg");
  canvasWrap.appendChild(svg);

  const canvas = document.createElement("div");
  canvas.className = "erd-canvas";
  canvasWrap.appendChild(canvas);

  if (!tab.erdData) {
    const loading = document.createElement("div");
    loading.className = "erd-loading"; loading.textContent = "Loading schema…";
    canvas.appendChild(loading);

    const conn = S.connections.find(c => c.id === tab.connId);
    if (!conn) { loading.textContent = "No connection found."; return; }
    try {
      const res = await fetch("/api/erd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: conn.type, connection: conn, schema: tab.erdSchema }),
      });
      tab.erdData = await res.json();
      save();
    } catch {
      loading.textContent = "Failed to load ERD data."; return;
    }
    canvas.textContent = "";
  }

  const { tables, relations } = tab.erdData!;
  if (!tables.length) {
    const empty = document.createElement("div");
    empty.className = "erd-loading"; empty.textContent = "No tables found in this schema.";
    canvas.appendChild(empty); return;
  }

  tables.forEach((tbl, i) => {
    if (!tab.erdPositions[tbl.name]) {
      const col = i % GRID_COLS, row = Math.floor(i / GRID_COLS);
      tab.erdPositions[tbl.name] = {
        x: 20 + col * (CARD_W + GAP),
        y: 20 + row * (CARD_H_BASE + tbl.columns.length * COL_H + GAP),
      };
    }
  });

  type CardEl = { el: HTMLElement; colEls: Record<string, HTMLElement> };
  const cardEls: Record<string, CardEl> = {};

  for (const tbl of tables) {
    const pos = tab.erdPositions[tbl.name];
    const card = document.createElement("div");
    card.className = "erd-card";
    card.style.left = pos.x + "px"; card.style.top = pos.y + "px";
    card.dataset.table = tbl.name;

    const hdr = document.createElement("div"); hdr.className = "erd-card-hdr";
    const hdrIcon = document.createElement("span"); hdrIcon.className = "erd-card-icon";
    hdrIcon.appendChild(makeSvgIcon("11","11",[svgEl("rect",{x:"3",y:"3",width:"18",height:"18",rx:"2"}),svgEl("line",{x1:"3",y1:"9",x2:"21",y2:"9"}),svgEl("line",{x1:"9",y1:"3",x2:"9",y2:"21"})]));
    const hdrName = document.createElement("span"); hdrName.className = "erd-card-name"; hdrName.textContent = tbl.name;
    const editBtn = document.createElement("button"); editBtn.className = "erd-card-edit"; editBtn.title = "Edit table"; editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => openTableEditor({ name: tbl.name, type: "table", parent: tbl.schema }, { schema: tbl.schema }));
    hdr.appendChild(hdrIcon); hdr.appendChild(hdrName); hdr.appendChild(editBtn);
    card.appendChild(hdr);

    const colEls: Record<string, HTMLElement> = {};
    for (const col of tbl.columns) {
      const row = document.createElement("div");
      row.className = "erd-card-col" + (col.isPrimary ? " erd-card-col--pk" : "");
      row.dataset.col = col.name;

      const pkBadge = document.createElement("span"); pkBadge.className = "erd-col-pk"; pkBadge.textContent = col.isPrimary ? "PK" : "";
      const colName = document.createElement("span"); colName.className = "erd-col-name"; colName.textContent = col.name;
      const colType = document.createElement("span"); colType.className = "erd-col-type"; colType.textContent = col.dataType;

      row.appendChild(pkBadge); row.appendChild(colName); row.appendChild(colType);
      card.appendChild(row);
      colEls[col.name] = row;
    }

    canvas.appendChild(card);
    cardEls[tbl.name] = { el: card, colEls };
    erdMakeDraggable(card, tbl.name, tab, svg, relations, cardEls, canvasWrap);
  }

  erdApplyTransform(canvas, svg, tab);
  erdDrawLines(svg, relations, cardEls, canvas, canvasWrap);
  erdSetupPan(canvasWrap, canvas, svg, tab);

  fitBtn.addEventListener("click", () => erdFitToScreen(tab, canvas, svg));
  zoomInBtn.addEventListener("click", () => { erdZoom(tab, canvas, svg, 0.15); });
  zoomOutBtn.addEventListener("click", () => { erdZoom(tab, canvas, svg, -0.15); });
}

function erdApplyTransform(canvas: HTMLElement, svg: SVGElement, tab: ErdTab): void {
  const t = `translate(${tab.erdPan.x}px, ${tab.erdPan.y}px) scale(${tab.erdZoom})`;
  canvas.style.transform = t; svg.style.transform = t;
  canvas.style.transformOrigin = "0 0"; svg.style.transformOrigin = "0 0";
}

function erdZoom(tab: ErdTab, canvas: HTMLElement, svg: SVGElement, delta: number): void {
  tab.erdZoom = Math.max(0.2, Math.min(2.5, tab.erdZoom + delta));
  erdApplyTransform(canvas, svg, tab);
  erdDrawLines(svg as SVGExtended, null, null, canvas, null);
}

function erdFitToScreen(tab: ErdTab, canvas: HTMLElement, svg: SVGElement): void {
  if (!tab.erdData?.tables.length) return;
  const wrap = canvas.parentElement!;
  const ww = wrap.clientWidth, wh = wrap.clientHeight;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [name, pos] of Object.entries(tab.erdPositions)) {
    const tbl = tab.erdData.tables.find(t => t.name === name);
    const h = 38 + (tbl?.columns.length ?? 0) * 24;
    minX = Math.min(minX, pos.x); minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + 220); maxY = Math.max(maxY, pos.y + h);
  }
  const pw = maxX - minX + 60, ph = maxY - minY + 60;
  tab.erdZoom = Math.min(2, Math.min(ww / pw, wh / ph));
  tab.erdPan = { x: (ww - pw * tab.erdZoom) / 2 - minX * tab.erdZoom + 30 * tab.erdZoom, y: 20 };
  erdApplyTransform(canvas, svg, tab);
}

type CardEl = { el: HTMLElement; colEls: Record<string, HTMLElement> };
type SVGExtended = SVGSVGElement & { _erdRelations?: FkRelation[] | null; _erdCardEls?: Record<string, CardEl> | null; _erdWrap?: Element | null };

function erdGetColAnchor(cardEl: HTMLElement, colEl: HTMLElement, canvasWrap: Element, side: "left" | "right"): { x: number; y: number } {
  const cardRect = cardEl.getBoundingClientRect();
  const colRect  = colEl.getBoundingClientRect();
  const wrapRect = canvasWrap.getBoundingClientRect();
  const y = colRect.top + colRect.height / 2 - wrapRect.top;
  const x = side === "right" ? cardRect.right - wrapRect.left : cardRect.left - wrapRect.left;
  return { x, y };
}

function erdDrawLines(svg: SVGExtended, relations: FkRelation[] | null, cardEls: Record<string, CardEl> | null, canvas: HTMLElement | null, canvasWrap: Element | null): void {
  if (!relations) {
    relations = svg._erdRelations ?? null;
    cardEls   = svg._erdCardEls ?? null;
    canvasWrap = svg._erdWrap ?? null;
  } else {
    svg._erdRelations = relations;
    svg._erdCardEls   = cardEls;
    svg._erdWrap      = canvasWrap ?? canvas?.parentElement ?? null;
  }
  if (!relations || !cardEls) return;

  svg.textContent = "";
  const wrap = svg._erdWrap!;

  const defs = document.createElementNS("http://www.w3.org/2000/svg","defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg","marker");
  marker.setAttribute("id","erd-arrow"); marker.setAttribute("markerWidth","8");
  marker.setAttribute("markerHeight","8"); marker.setAttribute("refX","6");
  marker.setAttribute("refY","3"); marker.setAttribute("orient","auto");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg","path");
  arrow.setAttribute("d","M0,0 L0,6 L8,3 z"); arrow.setAttribute("fill","#4a9eff");
  marker.appendChild(arrow); defs.appendChild(marker); svg.appendChild(defs);

  for (const rel of relations) {
    const fromCard = cardEls[rel.fromTable], toCard = cardEls[rel.toTable];
    if (!fromCard || !toCard) continue;
    const fromColEl = fromCard.colEls[rel.fromColumn], toColEl = toCard.colEls[rel.toColumn];
    if (!fromColEl || !toColEl) continue;

    const a1 = erdGetColAnchor(fromCard.el, fromColEl, wrap, "right");
    const a2 = erdGetColAnchor(toCard.el,   toColEl,   wrap, "left");
    const cx = (a2.x - a1.x) * 0.5;
    const d  = `M${a1.x},${a1.y} C${a1.x + cx},${a1.y} ${a2.x - cx},${a2.y} ${a2.x},${a2.y}`;

    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d", d); path.setAttribute("class", "erd-link"); path.setAttribute("marker-end","url(#erd-arrow)");
    svg.appendChild(path);

    path.addEventListener("mouseenter", () => { fromColEl.classList.add("erd-card-col--linked"); toColEl.classList.add("erd-card-col--linked"); path.classList.add("erd-link--hover"); });
    path.addEventListener("mouseleave", () => { fromColEl.classList.remove("erd-card-col--linked"); toColEl.classList.remove("erd-card-col--linked"); path.classList.remove("erd-link--hover"); });
  }
}

function erdMakeDraggable(card: HTMLElement, tableName: string, tab: ErdTab, svg: SVGExtended, relations: FkRelation[], cardEls: Record<string, CardEl>, canvasWrap: Element): void {
  let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;

  card.addEventListener("mousedown", e => {
    if ((e.target as Element).closest(".erd-card-edit")) return;
    e.preventDefault(); dragging = true;
    startX = e.clientX; startY = e.clientY;
    origX = tab.erdPositions[tableName].x; origY = tab.erdPositions[tableName].y;
    card.classList.add("erd-card--dragging");
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const dx = (e.clientX - startX) / tab.erdZoom, dy = (e.clientY - startY) / tab.erdZoom;
    const nx = origX + dx, ny = origY + dy;
    tab.erdPositions[tableName] = { x: nx, y: ny };
    card.style.left = nx + "px"; card.style.top = ny + "px";
    erdDrawLines(svg, null, null, null, null);
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false; card.classList.remove("erd-card--dragging"); save();
  });
}

function erdSetupPan(wrap: HTMLElement, canvas: HTMLElement, svg: SVGExtended, tab: ErdTab): void {
  let panning = false, px = 0, py = 0;

  wrap.addEventListener("mousedown", e => {
    if (e.target !== wrap && e.target !== svg && e.target !== canvas) return;
    panning = true; px = e.clientX - tab.erdPan.x; py = e.clientY - tab.erdPan.y;
    wrap.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", e => {
    if (!panning) return;
    tab.erdPan = { x: e.clientX - px, y: e.clientY - py };
    erdApplyTransform(canvas, svg, tab);
  });

  document.addEventListener("mouseup", () => { if (!panning) return; panning = false; wrap.style.cursor = ""; save(); });

  wrap.addEventListener("wheel", e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const rect = wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const newZoom = Math.max(0.2, Math.min(2.5, tab.erdZoom + delta));
    tab.erdPan.x = mx - (mx - tab.erdPan.x) * (newZoom / tab.erdZoom);
    tab.erdPan.y = my - (my - tab.erdPan.y) * (newZoom / tab.erdZoom);
    tab.erdZoom = newZoom;
    erdApplyTransform(canvas, svg, tab);
    erdDrawLines(svg, null, null, null, null);
  }, { passive: false });
}
