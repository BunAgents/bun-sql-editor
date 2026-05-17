export function sqlFormat(sql: string): string {
  const CLAUSE_KW = /^(SELECT|FROM|WHERE|JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|INNER\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|ON|AND|OR|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|UNION|UNION\s+ALL|INSERT\s+INTO|VALUES|UPDATE|SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|WITH|RETURNING)$/i;

  type Part = { s: string; raw: boolean };
  const parts: Part[] = [];
  let i = 0;

  while (i < sql.length) {
    if (sql[i] === "'" || sql[i] === '"' || sql[i] === '`') {
      const q = sql[i]; let j = i + 1;
      while (j < sql.length && sql[j] !== q) { if (sql[j] === '\\') j++; j++; }
      parts.push({ s: sql.slice(i, j + 1), raw: true }); i = j + 1; continue;
    }
    if (sql[i] === '-' && sql[i+1] === '-') {
      const end = sql.indexOf('\n', i);
      parts.push({ s: end === -1 ? sql.slice(i) : sql.slice(i, end + 1), raw: true });
      i = end === -1 ? sql.length : end + 1; continue;
    }
    if (sql[i] === '/' && sql[i+1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      parts.push({ s: end === -1 ? sql.slice(i) : sql.slice(i, end + 2), raw: true });
      i = end === -1 ? sql.length : end + 2; continue;
    }
    if (/\s/.test(sql[i])) {
      parts.push({ s: ' ', raw: false });
      while (i < sql.length && /\s/.test(sql[i])) i++;
      continue;
    }
    if (sql[i] === ',') { parts.push({ s: ',', raw: false }); i++; continue; }
    if (sql[i] === ';') { parts.push({ s: ';', raw: false }); i++; continue; }
    let j = i;
    while (j < sql.length && !/[\s,'";`]/.test(sql[j])) j++;
    parts.push({ s: sql.slice(i, j), raw: false }); i = j;
  }

  let out = '', indent = 0, col = 0;
  const emit = (s: string) => { out += s; col += s.length; };
  const nl = (extra = 0) => { out += '\n' + '  '.repeat(indent + extra); col = (indent + extra) * 2; };

  const MULTI_WORD = ['ORDER BY','GROUP BY','LEFT JOIN','RIGHT JOIN','INNER JOIN','FULL JOIN','CROSS JOIN','INSERT INTO','DELETE FROM','UNION ALL'];

  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if (p.s === ' ') continue;
    if (p.raw) { emit(p.s); continue; }
    if (p.s === ',') { out = out.trimEnd(); emit(','); nl(); continue; }
    if (p.s === ';') { out = out.trimEnd(); emit(';\n'); nl(); continue; }
    if (p.s === '(') { emit('('); indent++; continue; }
    if (p.s === ')') { indent = Math.max(0, indent - 1); out = out.trimEnd(); emit(')'); continue; }

    const upper = p.s.toUpperCase();
    let matched = '';
    for (const mw of MULTI_WORD) {
      const words = mw.split(' ');
      if (upper === words[0] && parts[k+1]?.s?.toUpperCase() === words[1]) {
        matched = mw; k++; break;
      }
    }
    const token = matched || upper;
    if (CLAUSE_KW.test(token)) {
      if (out.trim()) nl();
      emit(token.toUpperCase()); emit(' ');
    } else {
      emit(p.s); emit(' ');
    }
  }
  return out.trim().replace(/ +\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}
