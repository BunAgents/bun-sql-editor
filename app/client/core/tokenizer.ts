export type Token = { t: "kw" | "str" | "num" | "op" | "cmt" | "fn" | "text"; v: string };

const SQL_KW = new Set([
  "SELECT","FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER","FULL","CROSS","NATURAL",
  "ON","AS","AND","OR","NOT","IN","IS","NULL","LIKE","ILIKE","BETWEEN","ORDER","BY",
  "GROUP","HAVING","LIMIT","OFFSET","INSERT","INTO","VALUES","UPDATE","SET","DELETE",
  "CREATE","TABLE","VIEW","INDEX","DROP","ALTER","ADD","COLUMN","PRIMARY","KEY","FOREIGN",
  "REFERENCES","UNIQUE","DEFAULT","CONSTRAINT","WITH","UNION","ALL","DISTINCT","EXISTS",
  "CASE","WHEN","THEN","ELSE","END","OVER","PARTITION","WINDOW","LATERAL","RECURSIVE",
  "COUNT","SUM","AVG","MIN","MAX","COALESCE","NULLIF","CAST","CONVERT","NOW","CURRENT_DATE",
  "CURRENT_TIMESTAMP","DATE","TRIM","UPPER","LOWER","ROUND","FLOOR","CEIL","ABS",
  "LENGTH","SUBSTR","SUBSTRING","REPLACE","CONCAT","SHOW","DESCRIBE","EXPLAIN",
  "USE","DATABASE","DATABASES","TABLES","FORMAT","SETTINGS","ARRAY","TUPLE",
  "TRUE","FALSE","ASC","DESC","USING","RETURNING","CONFLICT","DO","NOTHING","UPDATE",
  "FILTER","ROLLUP","CUBE","GROUPING","SETS","FETCH","NEXT","ROWS","ONLY","TIES",
]);

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === "/" && text[i+1] === "*") {
      const end = text.indexOf("*/", i+2);
      const val = end === -1 ? text.slice(i) : text.slice(i, end + 2);
      tokens.push({ t: "cmt", v: val }); i += val.length; continue;
    }
    if (text[i] === "-" && text[i+1] === "-") {
      const end = text.indexOf("\n", i);
      const val = end === -1 ? text.slice(i) : text.slice(i, end + 1);
      tokens.push({ t: "cmt", v: val }); i += val.length; continue;
    }
    if (text[i] === "'") {
      let j = i + 1;
      while (j < text.length && !(text[j] === "'" && text[j-1] !== "\\")) j++;
      tokens.push({ t: "str", v: text.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (text[i] === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j++;
      tokens.push({ t: "fn", v: text.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (text[i] === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== "`") j++;
      tokens.push({ t: "fn", v: text.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (/[0-9]/.test(text[i]) && (i === 0 || /\W/.test(text[i-1]))) {
      let j = i;
      while (j < text.length && /[0-9._eExX]/.test(text[j])) j++;
      tokens.push({ t: "num", v: text.slice(i, j) }); i = j; continue;
    }
    if (/[a-zA-Z_]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[a-zA-Z0-9_$]/.test(text[j])) j++;
      const word = text.slice(i, j);
      tokens.push({ t: SQL_KW.has(word.toUpperCase()) ? "kw" : "text", v: word });
      i = j; continue;
    }
    if (/[=<>!+\-*/|&~%^]/.test(text[i])) {
      tokens.push({ t: "op", v: text[i] }); i++; continue;
    }
    tokens.push({ t: "text", v: text[i] }); i++;
  }
  return tokens;
}
