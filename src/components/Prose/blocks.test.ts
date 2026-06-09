import { describe, expect, it } from "vitest";
import { parseBlocks } from "./blocks";

describe("parseBlocks", () => {
  it("returns empty for empty input", () => {
    const { blocks, headings } = parseBlocks("");
    expect(blocks).toEqual([]);
    expect(headings).toEqual([]);
  });

  it("splits on blank lines", () => {
    const { blocks } = parseBlocks("one\n\ntwo\n\nthree");
    expect(blocks.map((b) => b.source)).toEqual(["one", "two", "three"]);
  });

  it("preserves fenced code as a single block, even with internal blank lines", () => {
    const src = "intro\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\nouttro";
    const { blocks } = parseBlocks(src);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]?.kind).toBe("code");
    expect(blocks[1]?.source).toBe("```ts\nconst a = 1;\n\nconst b = 2;\n```");
  });

  it("detects ATX heading levels and text", () => {
    const { blocks, headings } = parseBlocks(
      "# Title\n\n## Section\n\nbody\n\n### Sub\n\n#### Four\n\n##### Five\n\n###### Six",
    );
    expect(headings.map((h) => h.headingLevel)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(headings.map((h) => h.headingText)).toEqual([
      "Title",
      "Section",
      "Sub",
      "Four",
      "Five",
      "Six",
    ]);
    expect(blocks.find((b) => b.kind === "paragraph")?.source).toBe("body");
  });

  it("tolerates trailing newlines and CRLF line endings", () => {
    const { blocks } = parseBlocks("alpha\r\n\r\nbeta\r\n\r\n");
    expect(blocks.map((b) => b.source)).toEqual(["alpha", "beta"]);
  });

  it("groups multi-line paragraphs", () => {
    const { blocks } = parseBlocks("line one\nline two\nline three\n\nnext paragraph");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.source).toBe("line one\nline two\nline three");
    expect(blocks[0]?.kind).toBe("paragraph");
  });

  it("classifies lists, quotes, tables, and horizontal rules", () => {
    const { blocks } = parseBlocks(
      "- one\n- two\n\n> quoted\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n---",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["list", "quote", "table", "hr"]);
  });

  it("assigns stable index-based ids", () => {
    const { blocks } = parseBlocks("# H\n\npara\n\n- list");
    expect(blocks.map((b) => b.id)).toEqual(["block-0", "block-1", "block-2"]);
  });
});
