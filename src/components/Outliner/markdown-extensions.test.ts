import { describe, expect, it } from "vitest";
import { markInline, preprocessOutlinerMarkdown as pre, readInline } from "./markdown-extensions";

describe("markInline", () => {
  const math = [{ open: "$" }];
  const mark = (source: string) => markInline(source, math);
  /** The sources of the spans found, in order. */
  const spans = (source: string, types = math) =>
    [...markInline(source, types).matchAll(/`(sf-inline:[^`]*)`/g)].map(
      (found) => readInline(found[1] as string)?.source,
    );

  it("marks a span and keeps the text around it", () => {
    expect(mark("so $x^2$ holds")).toBe("so `sf-inline:0:x%5E2` holds");
    expect(spans("$a$ and $b + c$")).toEqual(["a", "b + c"]);
  });

  it("gives the source back as it was written", () => {
    const tex = "\\frac{a}{b} f((x)) #n [[p]] @2026-11-25 `q` | *r*";
    expect(spans(`$${tex}$`)).toEqual([tex]);
    // Nothing in the mark is left for the outline's own passes.
    expect(pre(`$${tex}$`, math)).toBe(mark(`$${tex}$`));
  });

  it("leaves prices alone", () => {
    expect(mark("for $5 and $10")).toBe("for $5 and $10");
    expect(mark("$5/$10")).toBe("$5/$10");
    expect(spans("costs $5 or $x$")).toEqual(["x"]);
  });

  it("needs a source that starts and ends without a space, on one line", () => {
    expect(mark("$ x$ and $x $")).toBe("$ x$ and $x $");
    expect(mark("$a\nb$")).toBe("$a\nb$");
    expect(mark("$$")).toBe("$$");
  });

  it("skips escaped delimiters, code and doubled delimiters", () => {
    expect(mark("\\$x$")).toBe("\\$x$");
    expect(spans("$a\\$b$")).toEqual(["a\\$b"]);
    expect(mark("`$x$` and ``a ` $y$``")).toBe("`$x$` and ``a ` $y$``");
    expect(mark("```\n$x$\n```")).toBe("```\n$x$\n```");
    expect(mark("$$x$$")).toBe("$$x$$");
    expect(spans("`open $a$")).toEqual(["a"]);
  });

  it("takes a closing delimiter of its own, and several types", () => {
    const types = [{ open: "$" }, { open: "\\(", close: "\\)" }];
    expect(markInline("\\(a + b\\) and $c$", types)).toBe(
      "`sf-inline:1:a%20%2B%20b` and `sf-inline:0:c`",
    );
  });

  it("reads only its own marks", () => {
    expect(readInline("sf-inline:0:x%5E2")).toEqual({ index: 0, source: "x^2" });
    expect(readInline("block-ref:b-7")).toBeNull();
    expect(readInline("sf-inline:0:%E0")).toBeNull();
  });
});

describe("preprocessOutlinerMarkdown", () => {
  it("turns [[wiki links]] into links with the wiki: scheme", () => {
    expect(pre("see [[Project Alpha]]")).toBe("see [Project Alpha](wiki:Project%20Alpha)");
    expect(pre("literal \\[[not a link]]")).toBe("literal \\[[not a link]]");
  });

  it("turns ((ids)) into block-reference code spans", () => {
    expect(pre("as in ((b-7))")).toBe("as in `block-ref:b-7`");
  });

  it("turns a #tag into a wiki link that keeps its hash", () => {
    expect(pre("note #project and #área/sub-1")).toBe(
      "note [#project](wiki:project) and [#área/sub-1](wiki:%C3%A1rea%2Fsub-1)",
    );
    expect(pre("#start")).toBe("[#start](wiki:start)");
  });

  it("takes #[[Two Words]] as one tag", () => {
    expect(pre("see #[[Project Alpha]] now")).toBe(
      "see [#Project Alpha](wiki:Project%20Alpha) now",
    );
  });

  it("leaves headings, hashes inside words and URL fragments alone", () => {
    expect(pre("# Heading")).toBe("# Heading");
    expect(pre("C# and F#")).toBe("C# and F#");
    expect(pre("[top](#top) and https://x.dev/#frag and a/#b")).toBe(
      "[top](#top) and https://x.dev/#frag and a/#b",
    );
    expect(pre("escaped \\#tag")).toBe("escaped \\#tag");
  });
});
