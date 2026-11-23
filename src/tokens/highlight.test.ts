// The highlighter's marks (issue #107) carry body text, which is never
// allowed to drop under the reading bar: hold it above 7:1 on every mark in
// both themes, so a later tweak to a token cannot quietly fail it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const darkStart = css.indexOf('[data-theme="dark"] {');

function tokens(theme: "light" | "dark"): Map<string, string> {
  const block = theme === "light" ? css.slice(0, darkStart) : css.slice(darkStart);
  const found = new Map<string, string>();
  for (const m of block.matchAll(/(--sf-color-[a-z-]+):\s*(#[0-9a-f]{6});/g)) {
    if (!found.has(m[1] as string)) found.set(m[1] as string, m[2] as string);
  }
  return found;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const COLORS = ["yellow", "green", "blue", "pink", "orange", "purple"];

describe("highlight tokens", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`keep body text above 7:1 on every mark (${theme})`, () => {
      const t = tokens(theme);
      const fg = t.get("--sf-color-fg") as string;
      for (const color of COLORS) {
        const mark = t.get(`--sf-color-highlight-${color}`);
        expect(mark, `--sf-color-highlight-${color} (${theme})`).toBeDefined();
        expect(contrast(fg, mark as string), color).toBeGreaterThan(7);
      }
    });
  }
});
