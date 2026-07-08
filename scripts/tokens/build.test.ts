import { describe, expect, it } from "vitest";
import {
  extractBlock,
  parseDeclarations,
  parseTokensCss,
  toStyleDictionary,
  toVars,
} from "./build.mjs";

const CSS = `
@layer sf.tokens {
  :root,
  [data-theme="light"] {
    /* a comment; with a semicolon */
    --sf-color-fg: #0a0a0a;
    --sf-color-bg-subtle: #f9fafb;
    --sf-font-mono:
      "JetBrains Mono", ui-monospace, monospace;
  }
  [data-theme="dark"] {
    --sf-color-fg: #fafafa;
  }
}
`;

describe("extractBlock + parseDeclarations", () => {
  it("brace-matches the light block and reads declarations, ignoring comments", () => {
    const block = extractBlock(
      CSS.replace(/\/\*[\s\S]*?\*\//g, ""),
      /:root\s*,\s*\[data-theme="light"\]/,
    );
    const decls = parseDeclarations(block);
    expect(decls["--sf-color-fg"]).toBe("#0a0a0a");
    expect(decls["--sf-color-bg-subtle"]).toBe("#f9fafb");
    // Multi-line value is collapsed to one line.
    expect(decls["--sf-font-mono"]).toBe('"JetBrains Mono", ui-monospace, monospace');
  });
});

describe("parseTokensCss", () => {
  it("separates light values from dark overrides", () => {
    const { light, dark } = parseTokensCss(CSS);
    expect(light["--sf-color-fg"]).toBe("#0a0a0a");
    expect(dark).toEqual({ "--sf-color-fg": "#fafafa" });
  });
});

describe("toVars", () => {
  it("camel-cases names into var() accessors", () => {
    const vars = toVars({ "--sf-color-bg-subtle": "#f9fafb" });
    expect(vars).toEqual({ colorBgSubtle: "var(--sf-color-bg-subtle)" });
  });
});

describe("toStyleDictionary", () => {
  it("nests dotted paths onto value leaves", () => {
    const tree = toStyleDictionary({ "--sf-color-bg-subtle": "#f9fafb" });
    expect(tree.color.bg.subtle).toEqual({ value: "#f9fafb" });
  });
});
