import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type IconSlot, SF_ICON_SLOTS } from "./icons";

describe("SF_ICON_SLOTS", () => {
  it("has no duplicate slots", () => {
    expect(new Set(SF_ICON_SLOTS).size).toBe(SF_ICON_SLOTS.length);
  });
});

/** Walk every `.tsx` under `src/` and collect the sources so the drift guard can
 *  scan the real call sites (mirrors `stacking.test.ts` reading `tokens.css`). */
function tsxSources(): string[] {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".tsx")) out.push(readFileSync(path, "utf8"));
    }
  };
  walk(root);
  return out;
}

describe("slot literals stay in lockstep with SF_ICON_SLOTS", () => {
  it('every <Glyph slot="…"> / useIcon("…") literal is a declared slot', () => {
    const valid = new Set<string>(SF_ICON_SLOTS);
    // `<Glyph … slot="foo">` (scoped to the tag so an unrelated `slot=` can't
    // trip it) and `useIcon("foo", …)` (our hook).
    const patterns = [
      /<Glyph\b[^>]*?\bslot=(?:"|')([a-zA-Z]+)(?:"|')/g,
      /\buseIcon\(\s*(?:"|')([a-zA-Z]+)(?:"|')/g,
    ];
    const unknown = new Set<string>();
    for (const src of tsxSources()) {
      for (const pattern of patterns) {
        for (const match of src.matchAll(pattern)) {
          const slot = match[1] as IconSlot;
          if (!valid.has(slot)) unknown.add(slot);
        }
      }
    }
    expect([...unknown], `these icon slot literals are not in SF_ICON_SLOTS`).toEqual([]);
  });
});
