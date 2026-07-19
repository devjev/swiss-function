#!/usr/bin/env node
/*
 * Geometry verification harness for swiss-function.
 *
 * Drives Ladle stories with Playwright and ASSERTS bounding-box geometry, so a
 * layout regression fails a check instead of hiding in a screenshot nobody
 * measured. Reads a JSON spec, runs every case in every theme, prints PASS/FAIL,
 * and exits non-zero on any failure.
 *
 * Usage:
 *   node .claude/skills/verify-geometry/measure.mjs <spec.json>
 * Prerequisite: Ladle running on :61000 (`npm run dev`).
 *
 * Spec:
 *   { baseUrl?, themes?, tolerance?, viewport?, cases: [{ story, checks: [...] }] }
 * Checks (selectors are Playwright locators: CSS, text=, role= — prefer stable
 * hooks like data-testid / text / role over hashed CSS-module class names):
 *   { type: "contained", parent }        every descendant box ⊆ parent box
 *   { type: "within", child, parent }    child box ⊆ parent box
 *   { type: "noOverlap", a, b }          boxes must not intersect
 *   { type: "box", selector }            report only (no assertion)
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const specPath = process.argv[2];
if (!specPath) {
  console.error("usage: node measure.mjs <spec.json>");
  process.exit(2);
}
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const baseUrl = spec.baseUrl ?? "http://localhost:61000";
const themes = spec.themes ?? ["light", "dark"];
const tol = spec.tolerance ?? 2;
const viewport = spec.viewport ?? { width: 1000, height: 720 };

const fmt = (b) =>
  b ? `{x:${Math.round(b.x)},y:${Math.round(b.y)},w:${Math.round(b.width)},h:${Math.round(b.height)}}` : "null";
const within = (c, p, t) =>
  c && p && c.x >= p.x - t && c.y >= p.y - t && c.x + c.width <= p.x + p.width + t && c.y + c.height <= p.y + p.height + t;
const overlaps = (a, b) =>
  a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await ctx.newPage();
const box = async (sel) => {
  const loc = page.locator(sel).first();
  return (await loc.count()) ? await loc.boundingBox() : null;
};

let failures = 0;
const pass = (m) => console.log(`  PASS ${m}`);
const fail = (m) => {
  failures++;
  console.log(`  FAIL ${m}`);
};

for (const c of spec.cases) {
  for (const theme of themes) {
    console.log(`\n${c.story} [${theme}]`);
    await page.goto(`${baseUrl}/?story=${c.story}&mode=preview&theme=${theme}`, {
      waitUntil: "networkidle",
      timeout: 20000,
    });
    await page.waitForTimeout(400);
    for (const check of c.checks) {
      try {
        if (check.type === "contained") {
          const overflow = await page.locator(check.parent).first().evaluate((el, t) => {
            const p = el.getBoundingClientRect();
            const bad = [];
            for (const d of el.querySelectorAll("*")) {
              const r = d.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              // Only flag spilling past the container's end (right / bottom), the
              // direction real overflow bugs take. Left/top negatives are the
              // off-screen sr-only input pattern, not a layout fault.
              if (r.right > p.right + t || r.bottom > p.bottom + t) {
                bad.push({ tag: d.tagName.toLowerCase(), right: Math.round(r.right), bottom: Math.round(r.bottom) });
                if (bad.length >= 4) break;
              }
            }
            return { parent: { right: Math.round(p.right), bottom: Math.round(p.bottom) }, bad };
          }, tol);
          if (overflow.bad.length === 0) pass(`nothing overflows ${check.parent}`);
          else fail(`${overflow.bad.length}+ descendants overflow ${check.parent} ${JSON.stringify(overflow.parent)}: ${JSON.stringify(overflow.bad)}`);
        } else if (check.type === "within") {
          const cb = await box(check.child);
          const pb = await box(check.parent);
          if (!cb || !pb) fail(`missing box: child=${!!cb} parent=${!!pb} (${check.child} / ${check.parent})`);
          else if (within(cb, pb, tol)) pass(`${check.child} within ${check.parent}`);
          else fail(`${check.child} NOT within ${check.parent}  child=${fmt(cb)} parent=${fmt(pb)}`);
        } else if (check.type === "noOverlap") {
          const ab = await box(check.a);
          const bb = await box(check.b);
          if (!ab || !bb) fail(`missing box: a=${!!ab} b=${!!bb} (${check.a} / ${check.b})`);
          else if (!overlaps(ab, bb)) pass(`${check.a} does not overlap ${check.b}`);
          else fail(`${check.a} OVERLAPS ${check.b}  a=${fmt(ab)} b=${fmt(bb)}`);
        } else if (check.type === "box") {
          console.log(`  BOX  ${check.selector} = ${fmt(await box(check.selector))}`);
        } else {
          fail(`unknown check type: ${check.type}`);
        }
      } catch (e) {
        fail(`${check.type}: ${e.message}`);
      }
    }
  }
}

await browser.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
