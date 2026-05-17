import { S } from "../data/state";

export function sortedRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (!S.sortCol) return rows;
  const col = S.sortCol;
  return [...rows].sort((a, b) => {
    const av = a[col], bv = b[col];
    const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : av > bv ? 1 : 0;
    return S.sortDir === "asc" ? cmp : -cmp;
  });
}

export function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
