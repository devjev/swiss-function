// Refresh vrt/stories.json — the manifest of every Ladle story the visual
// regression gate snapshots. Ladle serves the authoritative list at
// /meta.json; this writes the sorted story ids so the Playwright VRT run has a
// static, committed coverage list (and a fresh checkout can gate without a
// discovery round-trip).
//
// Usage: node scripts/vrt/list-stories.mjs   (Ladle must be running — `just dev`)
//   LADLE_URL overrides the default http://localhost:61000.
//
// An optional VRT_EXCLUDE env var (comma-separated story-id prefixes) drops
// groups from the gate — e.g. VRT_EXCLUDE="graph--,map--" to skip WebGL surfaces
// whose canvas output isn't pixel-deterministic across machines.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.LADLE_URL ?? "http://localhost:61000";
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "vrt", "stories.json");

let meta;
try {
  const res = await fetch(`${url}/meta.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  meta = await res.json();
} catch (err) {
  console.error(`Could not fetch ${url}/meta.json — is Ladle running (just dev)?\n  ${err}`);
  process.exit(1);
}

const exclude = (process.env.VRT_EXCLUDE ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ids = Object.keys(meta.stories ?? {})
  .filter((id) => !exclude.some((prefix) => id.startsWith(prefix)))
  .sort();

writeFileSync(out, `${JSON.stringify(ids, null, 2)}\n`);
console.log(`Wrote ${ids.length} story ids to vrt/stories.json`);
