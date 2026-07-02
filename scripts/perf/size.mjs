// Bundle-size tracker — walks the package.json `exports` map, follows each
// entry's dist ESM import graph, and reports raw + gzip bytes per entry
// (first-party files only; bare specifiers are recorded as externals).
// Anything under dist/node_modules resolves as a RELATIVE import and is
// therefore counted in the entry's cost — a wrongly-bundled dependency shows
// up as a giant number instead of hiding.
//
// Usage:
//   node scripts/perf/size.mjs [--update]
//
// Compares against perf/size-baseline.json when it exists: fails (exit 1) if
// any entry's total gzip grows by more than max(5%, 2 KB). `--update`
// rewrites the baseline. Requires a fresh `npm run build`.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const distDir = join(root, "dist");
const baselinePath = join(root, "perf", "size-baseline.json");
const update = process.argv.includes("--update");
const out = process.stdout.write.bind(process.stdout);

if (!existsSync(distDir)) {
  process.stderr.write("dist/ missing — run `npm run build` first.\n");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

// --- ESM import-graph walk -----------------------------------------------------
// Vite's preserveModules output uses static import/export statements only, so a
// regex scan is sufficient and dependency-free.
const SPECIFIER_RE =
  /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?from\s+)?["']([^"']+)["'];?|(?:^|\n)\s*import\s+["']([^"']+)["'];?/g;

function specifiersOf(source) {
  const specs = [];
  for (const match of source.matchAll(SPECIFIER_RE)) {
    const spec = match[1] ?? match[2];
    if (spec) specs.push(spec);
  }
  return specs;
}

function gzipBytes(buf) {
  return gzipSync(buf, { level: 9 }).length;
}

/** Walk one dist entry file; returns per-entry cost. */
function walkEntry(entryFile) {
  const seen = new Set();
  const externals = new Set();
  const queue = [resolve(entryFile)];
  let jsRaw = 0;
  let jsGzip = 0;
  let cssRaw = 0;
  let cssGzip = 0;
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const buf = readFileSync(file);
    if (file.endsWith(".css")) {
      cssRaw += buf.length;
      cssGzip += gzipBytes(buf);
      continue;
    }
    jsRaw += buf.length;
    jsGzip += gzipBytes(buf);
    for (const spec of specifiersOf(buf.toString("utf8"))) {
      if (spec.startsWith(".") || spec.startsWith("/")) {
        let target = resolve(dirname(file), spec);
        if (!existsSync(target) && existsSync(`${target}.js`)) target = `${target}.js`;
        queue.push(target);
      } else {
        externals.add(spec);
      }
    }
  }
  return {
    files: seen.size,
    jsRaw,
    jsGzip,
    cssRaw,
    cssGzip,
    gzip: jsGzip + cssGzip,
    externals: [...externals].sort(),
  };
}

// --- Measure every export entry ---------------------------------------------------
const entries = {};
for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  if (subpath === "./package.json") continue;
  const importTarget = typeof target === "string" ? target : target.import;
  if (!importTarget) continue;
  const file = join(root, importTarget);
  if (importTarget.endsWith(".css")) {
    const buf = readFileSync(file);
    entries[subpath] = {
      files: 1,
      jsRaw: 0,
      jsGzip: 0,
      cssRaw: buf.length,
      cssGzip: gzipBytes(buf),
      gzip: gzipBytes(buf),
      externals: [],
    };
  } else {
    entries[subpath] = walkEntry(file);
  }
}

const totalGzip = Object.values(entries).reduce((sum, e) => sum + e.gzip, 0);
const report = { meta: { date: new Date().toISOString() }, totalGzip, entries };

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
const sorted = Object.entries(entries).sort((a, b) => b[1].gzip - a[1].gzip);
for (const [name, e] of sorted.slice(0, 12)) {
  out(`${name.padEnd(24)} ${kb(e.gzip).padStart(9)} gzip (${e.files} files)\n`);
}
out(`… ${sorted.length} entries, Σ ${kb(totalGzip)} gzip (entries overlap via shared modules)\n`);

if (update) {
  writeFileSync(baselinePath, `${JSON.stringify(report, null, 2)}\n`);
  out(`baseline updated: ${baselinePath}\n`);
  process.exit(0);
}

let baseline = null;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {
  out("no perf/size-baseline.json — report-only run (use --update to create one)\n");
  process.exit(0);
}

let failures = 0;
for (const [name, e] of Object.entries(entries)) {
  const base = baseline.entries?.[name];
  if (!base) {
    out(`  ${name}: new entry (${kb(e.gzip)}) — passes; update the baseline\n`);
    continue;
  }
  const limit = Math.max(base.gzip * 1.05, base.gzip + 2048);
  if (e.gzip > limit) {
    process.stderr.write(
      `  ${name}: ${kb(e.gzip)} gzip exceeds baseline ${kb(base.gzip)} (+${kb(e.gzip - base.gzip)})\n`,
    );
    failures++;
  }
}
for (const name of Object.keys(baseline.entries ?? {})) {
  if (!entries[name]) out(`  ${name}: removed since baseline (warn)\n`);
}
if (failures > 0) {
  process.stderr.write(
    `${failures} entr(ies) grew beyond max(5%, 2KB). Run size:update if intended.\n`,
  );
  process.exit(1);
}
out("size: OK\n");
