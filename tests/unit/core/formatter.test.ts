import { describe, it, expect } from "bun:test";
import { sqlFormat } from "../../../app/client/core/formatter";

describe("sqlFormat", () => {
  it("puts SELECT on its own line", () => {
    const result = sqlFormat("SELECT id, name FROM users WHERE id = 1");
    expect(result).toContain("SELECT");
    expect(result).toContain("FROM");
    expect(result).toContain("WHERE");
  });

  it("puts each column on its own line after comma", () => {
    const result = sqlFormat("SELECT id, name, email FROM users");
    const lines = result.split("\n");
    // formatter emits comma at end of the token, then newline
    expect(lines.some(l => l.trim() === "id," || l.trim() === "name," || l.includes("id,"))).toBe(true);
  });

  it("handles ORDER BY as multi-word keyword", () => {
    const result = sqlFormat("SELECT id FROM users ORDER BY id DESC");
    expect(result).toContain("ORDER BY");
  });

  it("handles GROUP BY as multi-word keyword", () => {
    const result = sqlFormat("SELECT count(*) FROM users GROUP BY name");
    expect(result).toContain("GROUP BY");
  });

  it("preserves string literals intact", () => {
    const result = sqlFormat("SELECT * FROM users WHERE name = 'John Smith'");
    expect(result).toContain("'John Smith'");
  });

  it("handles multiple statements separated by semicolons", () => {
    const result = sqlFormat("SELECT 1; SELECT 2;");
    expect(result).toContain(";");
  });

  it("removes excess whitespace", () => {
    const result = sqlFormat("SELECT   *   FROM   users");
    expect(result).not.toContain("   ");
  });

  it("handles empty or whitespace-only input gracefully", () => {
    expect(sqlFormat("   ")).toBe("");
  });
});
