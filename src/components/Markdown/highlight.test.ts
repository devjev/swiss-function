import { describe, expect, it } from "vitest";
import { type CodeToken, highlightCode, knowsLanguage } from "./highlight";

/** A `${name}` substitution, built from parts so the test code can hold one
 *  without the linter taking it for a misquoted template. */
const sub = (name: string) => ["$", "{", name, "}"].join("");

/** The tokens of one kind, as text. */
const of = (tokens: CodeToken[], kind: CodeToken["kind"]) =>
  tokens.filter((t) => t.kind === kind).map((t) => t.text);

/** The tokens join back into the code, character for character. */
const joined = (tokens: CodeToken[]) => tokens.map((t) => t.text).join("");

describe("highlightCode", () => {
  it("keeps every character", () => {
    const code = [
      "export function f(a: string) {\n  return `x ",
      sub("a"),
      '` + "y"; // done\n}',
    ].join("");
    expect(joined(highlightCode(code, "ts"))).toBe(code);
    const py = 'def f(x):\n    """doc\n    more"""\n    return x  # c';
    expect(joined(highlightCode(py, "python"))).toBe(py);
  });

  it("marks TypeScript keywords, calls, types, strings and comments", () => {
    const t = highlightCode(
      "export function formatDate(input: string): Date {\n  return new Date(input); // local\n}",
      "ts",
    );
    expect(of(t, "keyword")).toEqual(["export", "function", "return", "new"]);
    expect(of(t, "definition")).toEqual(["formatDate", "string", "Date", "Date"]);
    expect(of(t, "comment")).toEqual(["// local"]);
    expect(of(t, "punctuation")).toContain("(");
  });

  it("reads Python strings across lines and # comments", () => {
    const t = highlightCode('def run():\n    s = """a\nb"""  # note\n    return None', "py");
    expect(of(t, "keyword")).toEqual(["def", "return", "None"]);
    expect(of(t, "definition")).toEqual(["run"]);
    expect(of(t, "string")).toEqual(['"""a\nb"""']);
    expect(of(t, "comment")).toEqual(["# note"]);
  });

  it("takes # as a shell comment only at the start of a word, and marks variables", () => {
    const t = highlightCode(
      ['echo "$HOME" a#b # real\nif [ $# -gt 0 ]; then echo ', sub("X"), "; fi"].join(""),
      "bash",
    );
    expect(of(t, "comment")).toEqual(["# real"]);
    expect(of(t, "definition")).toEqual(["$#", sub("X")]);
    expect(of(t, "keyword")).toEqual(["if", "then", "fi"]);
    expect(of(t, "string")).toEqual(['"$HOME"']);
  });

  it("matches SQL keywords whatever their case", () => {
    const t = highlightCode("SELECT name FROM users -- all\nwhere id = 1", "sql");
    expect(of(t, "keyword")).toEqual(["SELECT", "FROM", "where"]);
    expect(of(t, "comment")).toEqual(["-- all"]);
  });

  it("marks YAML keys and leaves values plain", () => {
    const t = highlightCode("name: build\nsteps:\n  - run: npm test # ci\n", "yaml");
    expect(of(t, "definition")).toEqual(["name", "steps", "run"]);
    expect(of(t, "comment")).toEqual(["# ci"]);
  });

  it("colours a diff by line: added, removed, and the headers", () => {
    const t = highlightCode("--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n same", "diff");
    expect(of(t, "meta")).toEqual(["--- a/x\n+++ b/x\n@@ -1 +1 @@\n"]);
    expect(of(t, "removed")).toEqual(["-old\n"]);
    expect(of(t, "added")).toEqual(["+new\n"]);
  });

  it("does not read a comment marker inside a string", () => {
    const t = highlightCode('const url = "http://x"; // real', "js");
    expect(of(t, "comment")).toEqual(["// real"]);
    expect(of(t, "string")).toEqual(['"http://x"']);
  });

  it("leaves an unknown language and a fence with no language plain", () => {
    expect(highlightCode("SELECT 1 // x", "")).toEqual([{ text: "SELECT 1 // x" }]);
    expect(highlightCode("ok", "text")).toEqual([{ text: "ok" }]);
    expect(knowsLanguage("TS")).toBe(true);
    expect(knowsLanguage("console")).toBe(false);
  });

  it("keeps each family's keywords to its own languages", () => {
    // `fn` is Rust's keyword and a plain name in JavaScript.
    expect(of(highlightCode("fn(...args);", "js"), "keyword")).toEqual([]);
    expect(of(highlightCode("fn main() {}", "rust"), "keyword")).toEqual(["fn"]);
    expect(of(highlightCode("func main() { defer f() }", "go"), "keyword")).toEqual([
      "func",
      "defer",
    ]);
  });

  it("does not take a digit run or a name inside a word for a keyword", () => {
    const t = highlightCode("const iffy = x2if + 0x1f;", "ts");
    expect(of(t, "keyword")).toEqual(["const"]);
  });
});
