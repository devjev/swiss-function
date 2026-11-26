// Phone audit of the Ladle stories: renders every story in vrt/stories.json
// at 390 x 844 with touch emulation (a coarse pointer, so the touch tokens
// and the automatic comfortable density apply) and measures what a screenshot
// hides:
//
//   overflow     stories whose page scrolls sideways
//   clipped      controls cut off by an ancestor that clips without scrolling,
//                or by the screen edge with nothing to scroll them back
//   collisions   text printed over other text
//   squeezed     text blocks wrapped into a sliver (under 5em wide, 3+ lines)
//   smallTargets controls whose hit area is under 24px on its short side
//                (WCAG 2.5.8). Left out, as the criterion's own exceptions:
//                inline links, and marks whose size and place are the data
//                (chart marks, minimap markers, calendar events, treemap
//                cells, timeline markers)
//   smallText    text fields under 16px (iOS zooms the page on focus)
//
// Usage: node scripts/mobile/audit.mjs [--update] [--only <regex>] [--json <file>]
//   Ladle must be running (`just dev`). LADLE_URL overrides http://localhost:61000.
//   Run it under `env -u LD_LIBRARY_PATH` in the nix dev shell, like the other
//   Playwright scripts.
//
// The run fails when a metric exceeds perf/mobile-baseline.json; `--update`
// rewrites the baseline. The counts depend on the stories, not the machine, so
// the baseline is committed. A metric at 0 is a hard gate from then on.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const baselinePath = join(root, "perf", "mobile-baseline.json");
const base = process.env.LADLE_URL ?? "http://localhost:61000";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const only = value("--only") ? new RegExp(value("--only")) : null;

// Stories that show the mouse metrics on purpose (beside the touch ones).
const SKIP = new Set(["touch--hit-areas"]);

const stories = JSON.parse(readFileSync(join(root, "vrt", "stories.json"), "utf8")).filter(
  (id) => !SKIP.has(id) && (!only || only.test(id)),
);

const METRICS = ["overflow", "clipped", "collisions", "squeezed", "smallTargets", "smallText"];

// Runs in the page.
const measure = () => {
  const vw = window.innerWidth;
  const name = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      // An SVG element's `className` is an object: read the attribute.
      const c = (e.getAttribute("class") ?? "").split(/\s+/)[0];
      const m = /^(.+)-module_([A-Za-z0-9]+)_/.exec(c ?? "");
      if (m) return `${m[1]}.${m[2]}`;
    }
    return el.tagName.toLowerCase();
  };
  const visible = (el) =>
    el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;

  // --- controls: hit area, clipping, text-entry size -------------------------
  const CONTROL =
    'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [role="slider"], [role="option"], [role="combobox"], [role="separator"][tabindex], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
  // Marks whose size and place are the data they show.
  const POSITIONAL = /^(Minimap\.label|Treemap\.cell|Calendar\.(bar|block)|Timeline\.eventMarker)$/;
  const smallTargets = [];
  const smallText = [];
  const clipped = [];
  for (const el of new Set(document.querySelectorAll(CONTROL))) {
    const r = el.getBoundingClientRect();
    // Zero-size and visually hidden native inputs (a custom control paints
    // over them) are not targets.
    if (r.width <= 2 || r.height <= 2 || r.left >= vw || !visible(el) || el.disabled) continue;
    // An inert subtree takes no tap and no focus: what it hides is not a control.
    if (el.closest("[inert]")) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === "none") continue;
    const textEntry =
      el.matches('textarea, select, [contenteditable="true"]') ||
      (el.tagName === "INPUT" &&
        !["checkbox", "radio", "range", "button", "submit", "file", "color"].includes(el.type));
    if (textEntry) {
      const px = Number.parseFloat(cs.fontSize);
      if (px < 16) smallText.push({ el: name(el), px });
    } else if (!(el instanceof SVGElement) && !(el.tagName === "A" && cs.display === "inline")) {
      // The hit area is the element's box or the pseudo-element that grows it
      // (lib/hitArea: `::after`, or `::before` on a handle), whichever is larger.
      let w = r.width;
      let h = r.height;
      // A slider's native input sits inside its thumb, which carries the area.
      const hosts =
        el.matches('input[type="range"]') && el.parentElement ? [el, el.parentElement] : [el];
      for (const host of hosts) {
        const own = host.getBoundingClientRect();
        w = Math.max(w, own.width);
        h = Math.max(h, own.height);
        for (const pseudo of ["::before", "::after"]) {
          const box = getComputedStyle(host, pseudo);
          if (box.content === "none" || box.position !== "absolute") continue;
          w = Math.max(w, Number.parseFloat(box.width) || 0);
          h = Math.max(h, Number.parseFloat(box.height) || 0);
        }
      }
      if (Math.min(w, h) < 23.5 && !POSITIONAL.test(name(el))) {
        smallTargets.push({ el: name(el), w: Math.round(w), h: Math.round(h) });
      }
    }
    if (el.matches("button, a[href], input, select, textarea, [role='tab']")) {
      let scrolls = false;
      let cutBy = null;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (/(auto|scroll)/.test(acs.overflowX)) {
          scrolls = true; // reachable by scrolling
          break;
        }
        if (/(hidden|clip)/.test(acs.overflowX)) {
          const ar = a.getBoundingClientRect();
          const cut = Math.max(r.right - ar.right, ar.left - r.left);
          if (cut > 2) {
            cutBy = { el: name(el), by: name(a), cut: Math.round(cut) };
            break;
          }
        }
      }
      // A control that runs past the screen edge with nothing to scroll it
      // back (an overlay wider than its frame) is cut by the viewport.
      const past = Math.max(r.right - vw, -r.left);
      if (!cutBy && !scrolls && past > 2) {
        cutBy = { el: name(el), by: "viewport", cut: Math.round(past) };
      }
      if (cutBy) clipped.push(cutBy);
    }
  }

  // --- text: collisions and slivers ----------------------------------------
  const clip = (el, rect) => {
    let { left, top, right, bottom } = rect;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const ar = a.getBoundingClientRect();
      if (cs.overflowX !== "visible") {
        left = Math.max(left, ar.left);
        right = Math.min(right, ar.right);
      }
      if (cs.overflowY !== "visible") {
        top = Math.max(top, ar.top);
        bottom = Math.min(bottom, ar.bottom);
      }
    }
    return { left, top, right, bottom };
  };
  // Nearest ancestor-or-self that paints its own surface.
  const surface = (el) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
      const parts = m ? m[1].split(/[,/ ]+/).filter(Boolean) : [];
      const alpha = parts.length >= 4 ? Number.parseFloat(parts[3]) : m ? 1 : 0;
      if (alpha > 0.5 || cs.backgroundImage !== "none") return a;
    }
    return null;
  };
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const p = n.parentElement;
    // Typeset math and a code editor place glyphs over one another on purpose.
    if (!p || !visible(p) || p.closest("script, style, title, desc, .katex, .cm-editor")) continue;
    range.selectNodeContents(n);
    for (const raw of range.getClientRects()) {
      const r = clip(p, raw);
      if (r.right - r.left < 3 || r.bottom - r.top < 3) continue;
      if (r.bottom < 0 || r.top > window.innerHeight * 3) continue;
      texts.push({ n, p, r, t: n.nodeValue.trim().slice(0, 16) });
    }
  }
  const collisions = [];
  const pairs = new Set();
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      if (a.n === b.n) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w < 3 || h < 3) continue;
      if (h < Math.min(a.r.bottom - a.r.top, b.r.bottom - b.r.top) * 0.4) continue;
      // One sits on its own surface that does not hold the other: layering (a
      // sticky header, a chip over a grid), which is not a collision.
      // A chart annotation's label is an overlay the consumer placed on the
      // data, with a halo for a surface: over a mark's own label it is
      // layering. Two annotation labels over each other still count.
      const overlay = (t) => name(t.p) === "Annotations.label";
      if (overlay(a) !== overlay(b)) continue;
      const sa = surface(a.p);
      const sb = surface(b.p);
      if ((sa && !sa.contains(b.p)) || (sb && !sb.contains(a.p))) continue;
      // One collision per pair of classes: a tick ladder that collides does so
      // along its whole length.
      const key = `${name(a.p)}|${name(b.p)}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      collisions.push({ a: name(a.p), b: name(b.p), ta: a.t, tb: b.t });
    }
  }
  const squeezed = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    let own = "";
    for (const c of el.childNodes) if (c.nodeType === 3) own += c.nodeValue;
    own = own.trim();
    if (own.length <= 12) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "inline") continue;
    // A rotated axis title is narrow on purpose.
    if (cs.writingMode !== "horizontal-tb" || cs.transform !== "none" || cs.rotate !== "none")
      continue;
    const fs = Number.parseFloat(cs.fontSize);
    const lh = Number.parseFloat(cs.lineHeight) || fs * 1.4;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.width < fs * 5 && r.height >= lh * 3) {
      squeezed.push({ el: name(el), t: own.slice(0, 20), w: Math.round(r.width) });
    }
  }

  return {
    coarse: matchMedia("(pointer: coarse)").matches,
    overflow:
      document.documentElement.scrollWidth > vw + 1
        ? [{ by: document.documentElement.scrollWidth - vw }]
        : [],
    clipped,
    collisions,
    squeezed,
    smallTargets,
    smallText,
  };
};

const browser = await chromium.launch();
const results = [];
const queue = [...stories];
const worker = async () => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  for (;;) {
    const id = queue.shift();
    if (!id) break;
    try {
      await page.goto(`${base}/?story=${encodeURIComponent(id)}&mode=preview&theme=light`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(200);
      results.push({ id, ...(await page.evaluate(measure)) });
    } catch (err) {
      results.push({ id, error: String(err).split("\n")[0] });
    }
  }
  await ctx.close();
};
try {
  await Promise.all(Array.from({ length: 8 }, worker));
} finally {
  await browser.close();
}

const failed = results.filter((r) => r.error);
if (failed.length) {
  console.error(`${failed.length} stories did not render (is Ladle running at ${base}?):`);
  for (const r of failed.slice(0, 10)) console.error(`  ${r.id}: ${r.error}`);
  process.exit(1);
}
if (results.some((r) => !r.coarse)) {
  console.error("The page did not report a coarse pointer; the touch tokens were not measured.");
  process.exit(1);
}

// A story id is `component--story`; chart and lib stories carry a group first.
const component = (id) => {
  const parts = id.split("--");
  return ["chart", "chart3d", "lib"].includes(parts[0]) && parts.length > 2
    ? `${parts[0]}--${parts[1]}`
    : parts[0];
};
const describe = (metric, item) => {
  if (metric === "overflow") return `page is ${item.by}px wider than the viewport`;
  if (metric === "clipped") return `${item.el} cut by ${item.by} (${item.cut}px)`;
  if (metric === "collisions") return `${item.a} "${item.ta}" over ${item.b} "${item.tb}"`;
  if (metric === "squeezed") return `${item.el} "${item.t}" ${item.w}px wide`;
  if (metric === "smallTargets") return `${item.el} ${item.w}x${item.h}`;
  return `${item.el} ${item.px}px`;
};

const totals = Object.fromEntries(
  METRICS.map((m) => [m, results.reduce((sum, r) => sum + r[m].length, 0)]),
);
if (value("--json")) writeFileSync(value("--json"), JSON.stringify(results));

console.log(`${results.length} stories at 390 x 844, touch`);
for (const metric of METRICS) {
  const byComponent = new Map();
  for (const r of results) {
    if (!r[metric].length) continue;
    const key = component(r.id);
    const entry = byComponent.get(key) ?? {
      count: 0,
      example: `${r.id}: ${describe(metric, r[metric][0])}`,
    };
    entry.count += r[metric].length;
    byComponent.set(key, entry);
  }
  console.log(`\n${metric}: ${totals[metric]}`);
  const rows = [...byComponent.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
  for (const [key, entry] of rows) {
    console.log(`  ${String(entry.count).padStart(4)}  ${key.padEnd(26)} ${entry.example}`);
  }
}

if (flag("--update")) {
  if (only) {
    console.error("\n--update needs the full story set; drop --only.");
    process.exit(1);
  }
  writeFileSync(
    baselinePath,
    `${JSON.stringify({ stories: results.length, ...totals }, null, 2)}\n`,
  );
  console.log(`\nWrote ${baselinePath}`);
  process.exit(0);
}
if (only) process.exit(0);

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {
  console.error("\nNo perf/mobile-baseline.json; run with --update to write one.");
  process.exit(1);
}
const worse = METRICS.filter((m) => totals[m] > (baseline[m] ?? 0));
console.log("");
for (const metric of METRICS) {
  const was = baseline[metric] ?? 0;
  const mark = totals[metric] > was ? "worse" : totals[metric] < was ? "better" : "same";
  console.log(
    `${metric.padEnd(13)} ${String(totals[metric]).padStart(5)}  baseline ${String(was).padStart(5)}  ${mark}`,
  );
}
if (worse.length) {
  console.error(`\nFailed: ${worse.join(", ")} above the baseline.`);
  process.exit(1);
}
if (METRICS.some((m) => totals[m] < (baseline[m] ?? 0))) {
  console.log("\nBetter than the baseline: run with --update to lock it in.");
}
