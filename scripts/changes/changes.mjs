#!/usr/bin/env node
// Lightweight changesets for the Forgejo release flow (issue #48).
//
// Each change lands with a markdown changeset in `.changes/` declaring the
// intended version bump and a human note. `just release` aggregates the pending
// changesets into a single bump, prepends generated notes to CHANGELOG.md, and
// deletes the consumed files — replacing the hand-written release-notes step
// while keeping the existing `npm version` + Forgejo publish flow (CI reads the
// CHANGELOG section for the release body).
//
// Deliberately NOT @changesets/cli: that tool's changelog/release automation is
// GitHub-centric (PR bot, GitHub Releases action) and would fight the
// self-hosted Forgejo registry + tag-triggered .gitea workflow. This is a thin
// convention that feeds the CI already in place.
//
// Subcommands:
//   add <patch|minor|major> <note…>   scaffold a changeset
//   status                            list pending changesets + resulting bump
//   version [--bump <b>] [--dry-run]  apply the bump: npm version + CHANGELOG +
//                                     delete consumed changesets
//
// Usage from the repo root; wired through `just changeset` / `just release`.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const changesDir = join(root, ".changes");
const changelogPath = join(root, "CHANGELOG.md");
const pkgPath = join(root, "package.json");

export const BUMPS = ["patch", "minor", "major"];
const BUMP_RANK = { patch: 1, minor: 2, major: 3 };

/** Parse a changeset file's `--- bump: x ---` frontmatter + note body. */
export function parseChangeset(content) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(content);
  if (!match) {
    return { bump: null, note: content.trim() };
  }
  const [, frontmatter, body] = match;
  let bump = null;
  for (const line of frontmatter.split("\n")) {
    const kv = /^\s*bump\s*:\s*(\w+)\s*$/.exec(line);
    if (kv) bump = kv[1];
  }
  return { bump, note: body.trim() };
}

/** Highest-ranked bump across a list, or null if empty/all-invalid. */
export function aggregateBump(bumps) {
  let best = null;
  for (const b of bumps) {
    if (BUMP_RANK[b] && (best === null || BUMP_RANK[b] > BUMP_RANK[best])) best = b;
  }
  return best;
}

/** Apply a semver bump to an "x.y.z" string. */
export function incrementVersion(version, bump) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!m) throw new Error(`Unparseable version: ${version}`);
  let [major, minor, patch] = m.slice(1).map(Number);
  if (bump === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bump === "minor") {
    minor += 1;
    patch = 0;
  } else if (bump === "patch") {
    patch += 1;
  } else {
    throw new Error(`Unknown bump: ${bump}`);
  }
  return `${major}.${minor}.${patch}`;
}

/** kebab-case slug for a changeset filename, capped for readability. */
export function slugify(note) {
  const base = note
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "change";
}

/** Read every changeset (excluding docs) as { file, bump, note }. */
export function collectChangesets(dir = changesDir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .sort()
    .map((f) => ({ file: f, ...parseChangeset(readFileSync(join(dir, f), "utf8")) }));
}

/** Render a CHANGELOG section: entries grouped by bump, newest bump first. */
export function renderChangelogSection(version, date, entries) {
  const lines = [`## v${version} — ${date}`, ""];
  const headings = { major: "Major", minor: "Minor", patch: "Patch" };
  for (const bump of ["major", "minor", "patch"]) {
    const forBump = entries.filter((e) => e.bump === bump);
    if (!forBump.length) continue;
    lines.push(`### ${headings[bump]}`, "");
    for (const e of forBump) {
      // Keep multi-line notes as a single bullet; collapse internal blank lines.
      lines.push(`- ${e.note.replace(/\n{2,}/g, "\n  ").trim()}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

// --- CLI --------------------------------------------------------------------

function cmdAdd(args) {
  const bump = args[0];
  if (!BUMPS.includes(bump)) {
    console.error(`usage: changes add <${BUMPS.join("|")}> <note…>`);
    process.exit(1);
  }
  const note = args.slice(1).join(" ").trim();
  if (!note) {
    console.error('A note is required: changes add minor "Add the X component"');
    process.exit(1);
  }
  mkdirSync(changesDir, { recursive: true });
  const slug = slugify(note);
  let file = `${slug}.md`;
  let n = 2;
  while (existsSync(join(changesDir, file))) {
    file = `${slug}-${n}.md`;
    n += 1;
  }
  writeFileSync(join(changesDir, file), `---\nbump: ${bump}\n---\n${note}\n`);
  console.log(`.changes/${file}`);
}

function cmdStatus() {
  const sets = collectChangesets();
  const current = JSON.parse(readFileSync(pkgPath, "utf8")).version;
  if (!sets.length) {
    console.log(`No pending changesets. Current version: ${current}.`);
    return;
  }
  console.log(`Pending changesets (${sets.length}):\n`);
  for (const s of sets) {
    const firstLine = s.note.split("\n")[0];
    console.log(`  [${s.bump ?? "?"}] ${firstLine}  (${s.file})`);
  }
  const bump = aggregateBump(sets.map((s) => s.bump));
  const next = bump ? incrementVersion(current, bump) : current;
  console.log(`\nAggregate bump: ${bump ?? "none"} → ${current} → ${next}`);
}

function cmdVersion(args) {
  const dryRun = args.includes("--dry-run");
  const bumpIdx = args.indexOf("--bump");
  const forcedBump = bumpIdx >= 0 ? args[bumpIdx + 1] : null;
  const sets = collectChangesets();
  const current = JSON.parse(readFileSync(pkgPath, "utf8")).version;

  const bump = forcedBump ?? aggregateBump(sets.map((s) => s.bump));
  if (!bump) {
    console.error(
      'No changesets to release. Add one with `just changeset <bump> "<note>"`,\n' +
        "or force a manual bump with `just release <patch|minor|major>`.",
    );
    process.exit(1);
  }
  if (forcedBump && !BUMPS.includes(forcedBump)) {
    console.error(`Invalid --bump ${forcedBump} (expected ${BUMPS.join("|")})`);
    process.exit(1);
  }

  const next = incrementVersion(current, bump);
  const date = new Date().toISOString().slice(0, 10);
  const entries = sets.length
    ? sets.map((s) => ({ bump: s.bump ?? "patch", note: s.note }))
    : [{ bump, note: "Maintenance release." }];
  const section = renderChangelogSection(next, date, entries);

  if (dryRun) {
    console.log(`Would bump ${current} → ${next} (${bump}) and write:\n`);
    console.log(section);
    if (sets.length) console.log(`Would delete: ${sets.map((s) => s.file).join(", ")}`);
    return;
  }

  // Bump package.json + package-lock.json without a git tag/commit; `just
  // release` owns the commit + tag + push.
  execFileSync("npm", ["version", bump, "--no-git-tag-version"], { cwd: root, stdio: "inherit" });

  // Insert the new section just above the newest existing release (the first
  // `## ` heading), preserving the title + any intro prose above it.
  const prev = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : "# Changelog\n";
  const firstEntry = prev.search(/^## /m);
  const updated =
    firstEntry === -1
      ? `${prev.trimEnd()}\n\n${section}\n`
      : `${prev.slice(0, firstEntry).trimEnd()}\n\n${section}\n${prev.slice(firstEntry)}`;
  writeFileSync(changelogPath, updated.replace(/\n{3,}/g, "\n\n"));

  for (const s of sets) rmSync(join(changesDir, s.file));
  console.log(`\nReleased ${next}. CHANGELOG updated; ${sets.length} changeset(s) consumed.`);
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "add") return cmdAdd(args);
  if (cmd === "status") return cmdStatus();
  if (cmd === "version") return cmdVersion(args);
  console.error("usage: changes <add|status|version> …");
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
