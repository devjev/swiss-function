import { describe, expect, it } from "vitest";
import { preprocessOutlinerMarkdown as pre } from "./markdown-extensions";

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
