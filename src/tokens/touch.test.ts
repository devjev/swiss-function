import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Source-level guards for the touch conventions (AGENTS.md, "Touch"). They
// read the stylesheets as text, so a rule that breaks a convention fails here
// before any browser runs.

const src = join(dirname(fileURLToPath(import.meta.url)), "..");

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

interface FoundRule {
  selector: string;
  /** The at-rule preludes that enclose the rule, outermost first. */
  context: string[];
}

/** Every style rule of a stylesheet with the at-rules around it. A small
 *  brace walker: enough for plain CSS without nesting inside style rules. */
function rules(css: string): FoundRule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: FoundRule[] = [];
  const stack: { prelude: string; at: boolean }[] = [];
  let prelude = "";
  for (const char of text) {
    if (char === "{") {
      const trimmed = prelude.trim();
      const at = trimmed.startsWith("@");
      if (!at) {
        found.push({
          selector: trimmed,
          context: stack.filter((s) => s.at).map((s) => s.prelude),
        });
      }
      stack.push({ prelude: trimmed, at });
      prelude = "";
    } else if (char === "}") {
      stack.pop();
      prelude = "";
    } else if (char === ";") {
      prelude = "";
    } else {
      prelude += char;
    }
  }
  return found;
}

describe("rules()", () => {
  it("reports a rule with the at-rules around it", () => {
    const css = `
      .a:hover { color: red; }
      @media (hover: hover) and (pointer: fine) {
        /* a comment with { braces } */
        .b:hover, .b:focus { color: red; }
        @media (prefers-reduced-motion: reduce) { .c { transition: none; } }
      }`;
    expect(rules(css)).toEqual([
      { selector: ".a:hover", context: [] },
      { selector: ".b:hover, .b:focus", context: ["@media (hover: hover) and (pointer: fine)"] },
      {
        selector: ".c",
        context: [
          "@media (hover: hover) and (pointer: fine)",
          "@media (prefers-reduced-motion: reduce)",
        ],
      },
    ]);
  });
});

describe("touch conventions", () => {
  const files = cssFiles(src);

  it("finds the stylesheets", () => {
    expect(files.length).toBeGreaterThan(80);
  });

  // A tap leaves `:hover` applied until the next tap elsewhere, so a hover
  // style on a touch screen is a stuck highlight. Every hover rule lives
  // inside a media query that names a hovering pointer.
  it("keeps every :hover rule inside a hover media query", () => {
    const loose: string[] = [];
    for (const file of files) {
      for (const rule of rules(readFileSync(file, "utf8"))) {
        if (!rule.selector.includes(":hover")) continue;
        const gated = rule.context.some((c) => c.startsWith("@media") && /\bhover\b/.test(c));
        if (!gated) loose.push(`${relative(src, file)}: ${rule.selector.replace(/\s+/g, " ")}`);
      }
    }
    expect(loose).toEqual([]);
  });

  // The dynamic viewport is the part of the screen a phone shows between its
  // toolbars; `100vh` is taller than that and puts a surface's lower edge
  // under the browser chrome.
  it("sizes nothing with the vh unit", () => {
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const match of text.matchAll(/[^\n;{]*\b\d+(\.\d+)?vh\b[^\n;]*/g)) {
        hits.push(`${relative(src, file)}: ${match[0].trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
