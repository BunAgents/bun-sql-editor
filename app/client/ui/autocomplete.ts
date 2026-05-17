import { el } from "./dom";
import { S } from "../data/state";
import { updateGutter, updateHighlight } from "./editor";
import { flushTabContent } from "./tabs";

const SQL_KEYWORDS = [
  "SELECT","FROM","WHERE","INSERT","INTO","VALUES","UPDATE","SET","DELETE",
  "CREATE","TABLE","DROP","ALTER","ADD","COLUMN","INDEX","VIEW","FUNCTION",
  "JOIN","LEFT","RIGHT","INNER","OUTER","FULL","CROSS","ON","AS","AND","OR",
  "NOT","IN","IS","NULL","LIKE","BETWEEN","EXISTS","CASE","WHEN","THEN","ELSE",
  "END","ORDER","BY","GROUP","HAVING","LIMIT","OFFSET","DISTINCT","COUNT","SUM",
  "AVG","MIN","MAX","COALESCE","CAST","WITH","RETURNING","BEGIN","COMMIT",
  "ROLLBACK","EXPLAIN","ANALYZE","TRUNCATE","VACUUM","GRANT","REVOKE",
  "PRIMARY","KEY","FOREIGN","REFERENCES","UNIQUE","DEFAULT","NOT NULL",
  "IF","EXISTS","CASCADE","RESTRICT","SCHEMA","DATABASE","SHOW","USE",
];

const CLICKHOUSE_KEYWORDS = [
  "SELECT","FROM","WHERE","INSERT","INTO","VALUES","CREATE","TABLE","DROP","ALTER",
  "ORDER","BY","GROUP","HAVING","LIMIT","OFFSET","DISTINCT","AS","AND","OR","NOT",
  "IN","IS","NULL","LIKE","BETWEEN","EXISTS","CASE","WHEN","THEN","ELSE","END",
  "JOIN","LEFT","RIGHT","INNER","FULL","CROSS","ARRAY","ON","WITH","UNION","ALL",
  "count","sum","avg","min","max","uniq","uniqExact","any","anyLast",
  "argMin","argMax","groupArray","quantile","quantiles","median","topK",
  "MergeTree","ReplicatedMergeTree","SummingMergeTree","AggregatingMergeTree",
  "ReplacingMergeTree","CollapsingMergeTree","Distributed","Memory","Log",
  "numbers","generateRandom","file","url","mysql","postgresql","s3",
  "PREWHERE","SAMPLE","FINAL","SETTINGS","FORMAT","ENGINE","PARTITION","TTL",
  "toDate","toDateTime","now","today","yesterday","toStartOfDay","toStartOfMonth",
  "toString","toInt32","toInt64","toFloat32","toFloat64","toUInt32","toUInt64",
  "length","lower","upper","trim","substring","position","match","extract",
  "ifNull","nullIf","isNull","coalesce","if","cityHash64","md5","generateUUIDv4",
  "JSONExtract","JSONExtractString","JSONExtractInt","EXPLAIN","SYSTEM",
];

const MONGO_KEYS = [
  "collection","action","filter","projection","limit","skip","sort","pipeline","field",
  "find","findOne","aggregate","count","distinct",
  "$eq","$ne","$gt","$gte","$lt","$lte","$in","$nin","$and","$or","$not","$nor",
  "$exists","$type","$regex","$all","$elemMatch","$size",
  "$set","$unset","$inc","$push","$pull","$addToSet","$pop","$rename",
  "$match","$group","$project","$sort","$limit","$skip","$unwind","$lookup",
  "$addFields","$replaceRoot","$count","$facet","$bucket","$sortByCount","$sample",
  "$sum","$avg","$min","$max","$first","$last",
];

type AcItem = { label: string; kind: string; detail?: string };

let _acItems: AcItem[] = [];
let _acIdx = -1;

function acGetPrefix(): { prefix: string; context: string | null; dot: boolean } | null {
  const pos = el.editor.selectionStart;
  const before = el.editor.value.slice(0, pos);
  const dotMatch = before.match(/"([^"]+)"\.(\w*)$/) || before.match(/(\w+)\.(\w*)$/);
  if (dotMatch) return { prefix: dotMatch[2], context: dotMatch[1], dot: true };
  const wordMatch = before.match(/(\w+)$/);
  return wordMatch ? { prefix: wordMatch[1], context: null, dot: false } : null;
}

function acBuildCandidates(prefix: string, context: string | null, dot: boolean): AcItem[] {
  const p = prefix.toLowerCase();
  const candidates: AcItem[] = [];

  if (dot && context) {
    const isSchema = S.schemaItems.some(i => i.type === "schema" && i.name === context);
    if (isSchema) {
      for (const item of S.schemaItems.filter(i => i.parent === context && i.type !== "schema")) {
        if (!p || item.name.toLowerCase().startsWith(p))
          candidates.push({ label: item.name, kind: item.type });
      }
      return candidates;
    }
    for (const [key, cols] of S.columnCache) {
      const tblName = key.split(".").pop();
      if (tblName === context && Array.isArray(cols)) {
        for (const col of cols) {
          if (!p || col.name.toLowerCase().startsWith(p))
            candidates.push({ label: col.name, kind: "column", detail: col.dataType });
        }
        return candidates;
      }
    }
    for (const item of S.schemaItems.filter(i => i.parent === context && i.type !== "schema")) {
      if (!p || item.name.toLowerCase().startsWith(p))
        candidates.push({ label: item.name, kind: item.type });
    }
    return candidates;
  }

  if (!p || p.length < 1) return [];

  const query = el.editor.value;
  const fromRe = /(?:FROM|JOIN)\s+(?:"?(\w+)"?\.)?"?(\w+)"?(?:\s+(?:AS\s+)?(\w+))?/gi;
  let fm: RegExpExecArray | null;
  while ((fm = fromRe.exec(query)) !== null) {
    const alias = fm[3] || fm[2];
    if (alias.toLowerCase().startsWith(p)) {
      const cacheKey = (fm[1] || "public") + "." + fm[2];
      const cols = S.columnCache.get(cacheKey);
      if (Array.isArray(cols)) {
        for (const col of cols) candidates.push({ label: col.name, kind: "column", detail: col.dataType });
      }
    }
  }

  for (const item of S.schemaItems.filter(i => i.type === "schema")) {
    if (item.name.toLowerCase().startsWith(p)) candidates.push({ label: item.name, kind: "schema" });
  }

  const seen = new Set<string>();
  for (const item of S.schemaItems.filter(i => i.type !== "schema")) {
    if (item.name.toLowerCase().startsWith(p) && !seen.has(item.name)) {
      candidates.push({ label: item.name, kind: item.type, detail: item.parent });
      seen.add(item.name);
    }
  }

  const conn = S.connections.find(c => c.id === S.activeConnId);
  const kwList = conn?.type === "clickhouse" ? CLICKHOUSE_KEYWORDS
               : conn?.type === "mongodb"    ? MONGO_KEYS
               : SQL_KEYWORDS;
  for (const kw of kwList) {
    if (kw.toLowerCase().startsWith(p)) candidates.push({ label: kw, kind: "keyword" });
  }

  return candidates.slice(0, 50);
}

function acShow(items: AcItem[], _prefix: string): void {
  _acItems = items;
  _acIdx = 0;
  el.acDropdown.textContent = "";

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = document.createElement("div");
    row.className = `ac-item${i === 0 ? " selected" : ""}`;
    row.setAttribute("role", "option");

    const kind = document.createElement("span");
    kind.className = `ac-item-kind ac-kind-${item.kind}`;
    kind.textContent = item.kind === "keyword" ? "kw" : item.kind.slice(0, 3);

    const label = document.createElement("span");
    label.className = "ac-item-label";
    label.textContent = item.label;

    row.appendChild(kind);
    row.appendChild(label);
    row.addEventListener("mousedown", e => { e.preventDefault(); acApply(i); });
    el.acDropdown.appendChild(row);
  }

  const coords = getCaretCoords();
  el.acDropdown.style.left = `${Math.min(coords.x, window.innerWidth - 380)}px`;
  el.acDropdown.style.top  = `${coords.y + 18}px`;
  el.acDropdown.hidden = false;
}

export function acHide(): void {
  el.acDropdown.hidden = true;
  _acItems = [];
  _acIdx = -1;
}

export function acSelect(delta: number): void {
  if (!_acItems.length) return;
  const rows = el.acDropdown.querySelectorAll(".ac-item");
  rows[_acIdx]?.classList.remove("selected");
  _acIdx = (_acIdx + delta + _acItems.length) % _acItems.length;
  rows[_acIdx]?.classList.add("selected");
  rows[_acIdx]?.scrollIntoView({ block: "nearest" });
}

export function acApply(idx?: number): void {
  if (idx === undefined) idx = _acIdx;
  if (idx < 0 || !_acItems[idx]) return;
  const item = _acItems[idx];
  const pos = el.editor.selectionStart;
  const v = el.editor.value;

  const m = acGetPrefix();
  if (!m) { acHide(); return; }

  const replaceStart = pos - m.prefix.length;
  const needsQuote = item.kind !== "keyword" && /[A-Z\s]/.test(item.label);
  const quoted = needsQuote ? `"${item.label}"` : item.label;
  el.editor.value = v.slice(0, replaceStart) + quoted + v.slice(pos);
  const newPos = replaceStart + quoted.length;
  el.editor.selectionStart = el.editor.selectionEnd = newPos;
  updateGutter();
  updateHighlight();
  flushTabContent();
  acHide();
}

export function acTrigger(): void {
  const m = acGetPrefix();
  if (!m || (m.prefix.length < 1 && !m.dot)) { acHide(); return; }
  const candidates = acBuildCandidates(m.prefix, m.context, m.dot);
  if (candidates.length) acShow(candidates, m.prefix);
  else acHide();
}

function getCaretCoords(): { x: number; y: number } {
  const ta = el.editor;
  const style = window.getComputedStyle(ta);
  const rect = ta.getBoundingClientRect();
  const lines = ta.value.slice(0, ta.selectionStart).split("\n");
  const lineH = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const col = lines[lines.length - 1].length;
  const charW = parseFloat(style.fontSize) * 0.6;
  return {
    x: rect.left + paddingLeft + col * charW,
    y: rect.top  + paddingTop  + (lines.length - 1) * lineH - ta.scrollTop,
  };
}
