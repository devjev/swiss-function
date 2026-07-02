// Interaction-latency perf runner — drives the scenario modules against a
// running Ladle server and compares medians against perf/baseline.json.
//
// Usage:
//   node scripts/perf/run.mjs [scenario…] [--runs 5] [--tolerance 0.2]
//                             [--base-url http://localhost:61000] [--update]
//
// Protocol per scenario: 1 discarded warmup run + N measured runs; the median
// of each metric is reported. Results always land in perf/results/; when
// perf/baseline.json exists the run compares against it and exits 1 on any
// regression beyond tolerance (and a 5ms absolute floor). `--update` rewrites
// the baseline from this run instead.
//
// Ladle must already be running (just dev). Numbers are machine-specific —
// the baseline records its host and a mismatch only warns.

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, hostname } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser, median, openStory, readHeapMB } from "./runner.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const resultsDir = join(root, "perf", "results");
const baselinePath = join(root, "perf", "baseline.json");

// --- CLI ---------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const update = args.includes("--update");
const runs = Number(flag("runs", "5"));
const tolerance = Number(flag("tolerance", "0.2"));
const baseUrl = flag("base-url", process.env.LADLE_URL ?? "http://localhost:61000");
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    if (["runs", "tolerance", "base-url"].includes(a.slice(2))) i++; // skip value
    continue;
  }
  positional.push(a);
}

const ALL = ["datatable", "explorer", "graph", "windowarray", "selector", "heatmap", "chat"];
const names = positional.length > 0 ? positional : ALL;
const out = process.stdout.write.bind(process.stdout);

// --- Preflight ----------------------------------------------------------------
try {
  await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
} catch {
  process.stderr.write(`Ladle is not reachable at ${baseUrl} — start it with \`just dev\`.\n`);
  process.exit(1);
}

// --- Run -----------------------------------------------------------------------
const browser = await launchBrowser();
const results = {};

for (const name of names) {
  if (!ALL.includes(name)) {
    process.stderr.write(`unknown scenario "${name}" (known: ${ALL.join(", ")})\n`);
    process.exit(1);
  }
  const module = await import(`./scenarios/${name}.mjs`);
  for (const scenario of module.scenarios) {
    const samples = [];
    for (let i = 0; i <= runs; i++) {
      const { context, page, frame, readyMs } = await openStory(browser, {
        storyId: scenario.story,
        baseUrl,
        readySelector: scenario.ready,
      });
      let metrics = {};
      try {
        metrics = (await scenario.run({ page, frame })) ?? {};
      } catch (error) {
        process.stderr.write(`  ${scenario.name}: run failed: ${error.message}\n`);
      }
      metrics.readyMs = readyMs;
      metrics.heapMB = await readHeapMB(frame).catch(() => null);
      await context.close();
      if (i > 0) samples.push(metrics); // discard the warmup run
    }
    const keys = new Set(samples.flatMap((s) => Object.keys(s)));
    const medians = {};
    for (const key of keys) {
      const values = samples.map((s) => s[key]).filter((v) => typeof v === "number");
      if (values.length > 0) medians[key] = median(values);
    }
    results[scenario.name] = medians;
    out(`${scenario.name}: ${JSON.stringify(medians)}\n`);
  }
}
await browser.close();

// --- Persist --------------------------------------------------------------------
const meta = {
  date: new Date().toISOString(),
  host: hostname(),
  cpus: cpus().length,
  node: process.version,
  commit: (() => {
    try {
      return execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
    } catch {
      return null;
    }
  })(),
  runs,
};
mkdirSync(resultsDir, { recursive: true });
const stamp = meta.date.replace(/[:.]/g, "-");
writeFileSync(
  join(resultsDir, `${meta.commit ?? "unknown"}-${stamp}.json`),
  `${JSON.stringify({ meta, results }, null, 2)}\n`,
);

if (update) {
  // Merge into any existing baseline so `perf:update` scoped to a few
  // scenarios refreshes only those entries instead of dropping the rest.
  let existing = {};
  try {
    existing = JSON.parse(readFileSync(baselinePath, "utf8")).results ?? {};
  } catch {
    // no baseline yet
  }
  const merged = { ...existing, ...results };
  writeFileSync(baselinePath, `${JSON.stringify({ meta, results: merged }, null, 2)}\n`);
  out(`baseline updated: ${baselinePath}\n`);
  process.exit(0);
}

// --- Compare ---------------------------------------------------------------------
let baseline = null;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {
  out("no perf/baseline.json — report-only run (use --update to create one)\n");
  process.exit(0);
}

if (baseline.meta?.host && baseline.meta.host !== meta.host) {
  process.stderr.write(
    `WARNING: baseline host "${baseline.meta.host}" differs from this machine ("${meta.host}") — timings are not comparable.\n`,
  );
}

// Absolute floor below which a relative regression is noise: single-digit
// metrics jitter by a few ms run-to-run (GC, compositor), so require both
// >tolerance AND >5ms of real movement.
const FLOOR_MS = 5;
let regressions = 0;
for (const [scenario, medians] of Object.entries(results)) {
  const base = baseline.results?.[scenario];
  if (!base) {
    out(`  ${scenario}: (new — no baseline)\n`);
    continue;
  }
  for (const [key, value] of Object.entries(medians)) {
    const ref = base[key];
    if (typeof ref !== "number" || typeof value !== "number") continue;
    const limit = ref * (1 + tolerance);
    const regressed = value > limit && value - ref > FLOOR_MS;
    const arrow = regressed ? "REGRESSED" : value < ref ? "improved" : "ok";
    out(`  ${scenario}.${key}: ${value} vs ${ref} (${arrow})\n`);
    if (regressed) regressions++;
  }
}
if (regressions > 0) {
  process.stderr.write(`${regressions} metric(s) regressed beyond ${tolerance * 100}%.\n`);
  process.exit(1);
}
out("perf: OK\n");
