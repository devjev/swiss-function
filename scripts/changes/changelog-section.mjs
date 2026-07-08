#!/usr/bin/env node
// Print the CHANGELOG.md notes for one version (the body under its `## vX`
// heading, without the heading). Used by .gitea/workflows/publish.yml to set
// the Forgejo release body from the changeset-generated CHANGELOG. Prints
// nothing (exit 0) if the file or section is missing, so CI degrades to an
// empty body rather than failing.
//
// Usage: node scripts/changes/changelog-section.mjs <version|vX.Y.Z>

import { readFileSync } from "node:fs";

const version = (process.argv[2] ?? "").replace(/^v/, "");
if (!version) process.exit(0);

let text = "";
try {
  text = readFileSync("CHANGELOG.md", "utf8");
} catch {
  process.exit(0);
}

const out = [];
let capturing = false;
for (const line of text.split("\n")) {
  // A release heading is exactly "## " (two hashes); "### Minor" sub-headings
  // start with "### " and are left untouched.
  if (line.startsWith("## ")) {
    const v = line.slice(3).trim().replace(/^v/, "").split(/\s/)[0];
    if (capturing) break; // hit the next release section
    if (v === version) {
      capturing = true;
      continue; // skip the heading line itself
    }
  }
  if (capturing) out.push(line);
}

process.stdout.write(out.join("\n").trim());
