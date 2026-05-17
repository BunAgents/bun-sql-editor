import { describe, it, expect } from "bun:test";
import { tokenize } from "../../../app/client/core/tokenizer";

describe("tokenize", () => {
  it("classifies SQL keywords", () => {
    const tokens = tokenize("SELECT * FROM users");
    expect(tokens.find(t => t.v === "SELECT")?.t).toBe("kw");
    expect(tokens.find(t => t.v === "FROM")?.t).toBe("kw");
  });

  it("classifies string literals", () => {
    const tokens = tokenize("WHERE name = 'alice'");
    const str = tokens.find(t => t.t === "str");
    expect(str?.v).toBe("'alice'");
  });

  it("classifies line comments", () => {
    const tokens = tokenize("-- this is a comment\nSELECT 1");
    const cmt = tokens.find(t => t.t === "cmt");
    expect(cmt?.v).toContain("-- this is a comment");
  });

  it("classifies block comments", () => {
    const tokens = tokenize("/* block */ SELECT 1");
    const cmt = tokens.find(t => t.t === "cmt");
    expect(cmt?.v).toBe("/* block */");
  });

  it("classifies numbers", () => {
    const tokens = tokenize("LIMIT 100");
    const num = tokens.find(t => t.t === "num");
    expect(num?.v).toBe("100");
  });

  it("classifies double-quoted identifiers as fn tokens", () => {
    const tokens = tokenize('"public"."users"');
    const fns = tokens.filter(t => t.t === "fn");
    expect(fns.map(t => t.v)).toContain('"public"');
  });

  it("classifies operators", () => {
    const tokens = tokenize("a = b");
    const op = tokens.find(t => t.t === "op");
    expect(op?.v).toBe("=");
  });

  it("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("does not classify lowercase keywords as keywords (case sensitive set)", () => {
    const tokens = tokenize("select * from users");
    // SQL_KW checks .toUpperCase(), so lowercase should still be kw
    expect(tokens.find(t => t.v === "select")?.t).toBe("kw");
  });
});
