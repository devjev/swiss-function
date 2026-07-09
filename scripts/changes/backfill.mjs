// One-off: reconstruct CHANGELOG.md history from git.
//
// The history spans several release conventions:
//   - early: feature branches merged to main; the change is in the MERGE commit
//     ("Merge feat/x: <desc>" or "Merge pull request '<desc>' (#n) from …"),
//     with a separate "Release vX.Y.Z" commit marking the version.
//   - transitional: "<feature>; release vX.Y.Z" in one commit.
//   - recent: a bare "X.Y.Z" `npm version` bump commit; the changes are the
//     preceding direct commits.
// So we walk main's first-parent line newest→oldest (KEEPING merges — that's
// where early descriptions live), reduce each commit to an "effective" change
// line, and attribute the accumulated lines to the release marker that closes
// their version. Commits after the newest marker are unreleased (they're in
// .changes/) and skipped. Prints sections newest-first to stdout.

import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const bumpKind = (prev, cur) => {
  if (!prev) return "initial";
  const [pM, pm] = prev.split(".").map(Number);
  const [cM, cm] = cur.split(".").map(Number);
  if (cM !== pM) return "major";
  if (cm !== pm) return "minor";
  return "patch";
};

/** Reduce a merge subject to the feature description it carries, or null to
 *  skip it (internal "merge main into …" noise). */
function describeMerge(s) {
  if (/^merge\s+(branch\s+['"]?main['"]?|remote-tracking)/i.test(s)) return null;
  let m = /^merge\s+pull\s+request\s+['"](.+?)['"]/i.exec(s);
  if (m) return m[1];
  m = /^merge\s+[^:]+:\s*(.+)$/i.exec(s); // "Merge feat/x: desc"
  if (m) return m[1].trim();
  m = /^merge\s+['"]?([\w/.-]+)['"]?\s+into\b/i.exec(s); // "Merge feat/x into main (vX)"
  if (m) return m[1].replace(/^(feat|fix|chore|ci|tweak)\//, "").replace(/[-/]/g, " ");
  return s;
}

/** Parse a release marker → { version, desc } (desc may be ""), or null. */
function parseRelease(subject) {
  let m = /^release\s+v?(\d+\.\d+\.\d+)\s*[:\-—]?\s*(.*)$/i.exec(subject);
  if (m) return { version: m[1], desc: m[2].trim() };
  m = /^(.*?)[;,]\s*release[- ]?v?(\d+\.\d+\.\d+).*$/i.exec(subject);
  if (m) return { version: m[2], desc: m[1].trim() };
  m = /^v?(\d+\.\d+\.\d+)$/.exec(subject);
  if (m) return { version: m[1], desc: "" };
  return null;
}

// Oldest-first: releases are cut in order, so commits accumulate until a marker
// closes their version. (Newest-first would misattribute a commit made after a
// release to that release instead of the next one.)
const lines = git("log", "--first-parent", "--format=%s%x09%cd%x09%P", "--date=short", "HEAD")
  .split("\n")
  .filter(Boolean)
  .reverse();

const versions = [];
let pending = [];
for (const line of lines) {
  const [subject, date, parents] = line.split("\t");
  const isMerge = (parents ?? "").trim().includes(" ");
  const eff = isMerge ? describeMerge(subject) : subject;
  if (eff == null) continue; // skipped noise merge
  const r = parseRelease(eff);
  if (r) {
    // The marker's own desc is the headline; the accumulated commits precede it.
    const changes = r.desc ? [r.desc, ...pending] : [...pending];
    pending = [];
    versions.push({ version: r.version, date, changes });
  } else {
    pending.push(eff);
  }
}
// Leftover pending = unreleased commits (in .changes/) — dropped.

const sections = versions.map((v, i) => {
  const kind = bumpKind(versions[i - 1]?.version, v.version);
  const seen = new Set();
  const uniq = v.changes.filter(
    (c) => c && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()),
  );
  let bullets;
  if (uniq.length) bullets = uniq.map((c) => `- ${c}`);
  else bullets = [i === 0 ? "- Initial release." : "- Maintenance release (no code changes)."];
  return `## v${v.version} — ${v.date} (${kind})\n\n${bullets.join("\n")}`;
});

sections.reverse(); // newest first
process.stdout.write(`${sections.join("\n\n")}\n`);
