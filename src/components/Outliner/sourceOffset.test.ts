import { describe, expect, it } from "vitest";
import { sourceOffsetFromRendered } from "./sourceOffset";

/** The source offset for a click before `needle` in the rendered text. */
function at(source: string, rendered: string, needle: string): string {
  const offset = sourceOffsetFromRendered(source, rendered, rendered.indexOf(needle));
  return `${source.slice(0, offset)}|${source.slice(offset)}`;
}

describe("sourceOffsetFromRendered", () => {
  it("is the identity on plain text", () => {
    expect(at("Hello world", "Hello world", "world")).toBe("Hello |world");
    expect(at("Hello world", "Hello world", "lo")).toBe("Hel|lo world");
  });

  it("returns 0 at the start and the full length at the end", () => {
    expect(sourceOffsetFromRendered("**bold**", "bold", 0)).toBe(0);
    expect(sourceOffsetFromRendered("**bold**", "bold", 4)).toBe(8);
    expect(sourceOffsetFromRendered("plain", "plain\n", 5)).toBe(5);
  });

  it("skips emphasis markers", () => {
    expect(at("some **bold** text", "some bold text", "old")).toBe("some **b|old** text");
    expect(at("some **bold** text", "some bold text", "text")).toBe("some **bold** |text");
  });

  it("skips a link's target", () => {
    const source = "see [the docs](https://example.com/a) now";
    expect(at(source, "see the docs now", "docs")).toBe(
      "see [the |docs](https://example.com/a) now",
    );
    expect(at(source, "see the docs now", "now")).toBe(
      "see [the docs](https://example.com/a) |now",
    );
  });

  it("lands inside a wiki link's brackets", () => {
    expect(at("to [[Project Alpha]] today", "to Project Alpha today", "Alpha")).toBe(
      "to [[Project |Alpha]] today",
    );
  });

  it("follows list items inside one block", () => {
    expect(at("- one\n- two", "one\ntwo", "two")).toBe("- one\n- |two");
  });

  it("stops where the rendered text is not in the source (a block reference)", () => {
    const source = "Body: ((src))";
    const rendered = "Body: The source bullet";
    const offset = sourceOffsetFromRendered(source, rendered, rendered.indexOf("bullet"));
    expect(offset).toBeGreaterThanOrEqual("Body: ".length);
    expect(offset).toBeLessThanOrEqual(source.length);
  });
});
