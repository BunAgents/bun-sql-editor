import { describe, it, expect } from "bun:test";
import { csvEscape, sortedRows } from "../../../app/client/core/utils";

// sortedRows depends on S.sortCol/S.sortDir from module state
// We test csvEscape (pure) and sortedRows (impure but predictable)

describe("csvEscape", () => {
  it("returns value unchanged if no special chars", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape("123")).toBe("123");
  });

  it("wraps values containing commas in double quotes", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
  });

  it("wraps values containing double quotes and escapes them", () => {
    expect(csvEscape('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps values containing newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles null/undefined as empty string", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("converts numbers to strings", () => {
    expect(csvEscape(42)).toBe("42");
  });
});

describe("sortedRows", () => {
  const rows = [
    { id: 3, name: "charlie" },
    { id: 1, name: "alice" },
    { id: 2, name: "bob" },
  ];

  it("returns rows unchanged when sortCol is null", () => {
    // S.sortCol defaults to null in state — sortedRows returns input as-is
    const { S } = require("../../../app/client/data/state");
    S.sortCol = null;
    const result = sortedRows(rows);
    expect(result[0].id).toBe(3);
  });

  it("sorts ascending by a numeric column", () => {
    const { S } = require("../../../app/client/data/state");
    S.sortCol = "id";
    S.sortDir = "asc";
    const result = sortedRows(rows);
    expect(result.map(r => r.id)).toEqual([1, 2, 3]);
  });

  it("sorts descending by a numeric column", () => {
    const { S } = require("../../../app/client/data/state");
    S.sortCol = "id";
    S.sortDir = "desc";
    const result = sortedRows(rows);
    expect(result.map(r => r.id)).toEqual([3, 2, 1]);
  });

  it("sorts ascending by a string column", () => {
    const { S } = require("../../../app/client/data/state");
    S.sortCol = "name";
    S.sortDir = "asc";
    const result = sortedRows(rows);
    expect(result.map(r => r.name)).toEqual(["alice", "bob", "charlie"]);
  });

  it("does not mutate the original array", () => {
    const { S } = require("../../../app/client/data/state");
    S.sortCol = "id";
    S.sortDir = "asc";
    const original = [...rows];
    sortedRows(rows);
    expect(rows[0].id).toBe(original[0].id);
  });
});
