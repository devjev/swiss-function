// Build the usage guide a host project gets from `npx swiss-function guide`.
//
// AGENTS.md serves two readers: agents building UIs with the library, and, in
// its "(for contributors)" sections, agents working on the library itself.
// The host guide is the first half: the contributor sections are dropped, the
// intro and the closing section are rewritten for a host, and two markers
// handle the sentences in between:
//
//   <!-- guide:skip -->…<!-- /guide:skip -->   left out of the guide
//   <!-- guide:host … -->                       only in the guide
//
// Both are HTML comments, so AGENTS.md renders without them. The guide ships
// in dist/guide/ beside the API reference and AESTHETICS.md, with links
// rewritten to those copies; a link to a file that does not ship keeps its
// text and loses the link.
//
//   node scripts/guide/build.mjs        (part of `npm run build`)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const PACKAGE = "@tarassov-ch/swiss-function";

const INTRO = `# Using ${PACKAGE}

A guide for coding agents (Claude Code, Cursor, Codex, anything else with tool
use) building UIs in this project with \`${PACKAGE}\`. Read it before you reach
for a \`<div className="bg-gray-100 p-4 rounded-lg">\`.

Pair it with [AESTHETICS.md](./AESTHETICS.md), which describes *why* the
library looks the way it does, and [API.md](./API.md), the per-component prop
reference. This file is *what to do*.

---
`;

const MORE = `## Where to look for more

- **Props**: [API.md](./API.md), every component's props, defaults and \`--sf-*\` variables.
- **Tokens**: \`${PACKAGE}/tokens.css\` declares every \`--sf-*\` variable; \`tokens.json\` and \`tokens.js\` carry the same values for code.
- **Why it looks the way it does**: [AESTHETICS.md](./AESTHETICS.md).
- **Types**: every entry ships its \`.d.ts\`, and the doc comments on the props cover what this guide leaves out.
`;

/** Remove `<!-- guide:skip -->…<!-- /guide:skip -->` spans and unwrap
 *  `<!-- guide:host … -->` comments. */
export function applyMarkers(text) {
  return text
    .replace(/<!-- guide:skip -->[\s\S]*?<!-- \/guide:skip -->/g, "")
    .replace(/<!-- guide:host ([\s\S]*?) -->/g, "$1");
}

/** Point relative links at the shipped copies (`map` from the link target as
 *  written to its target in dist/guide) and unlink the rest. Anchors, absolute
 *  URLs and `mailto:` stay. */
export function rewriteLinks(text, map) {
  return text.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, label, target) => {
    if (/^(?:[a-z]+:|#)/i.test(target)) return whole;
    const [path, hash = ""] = target.split("#");
    const mapped = map[path];
    if (mapped) return `[${label}](${mapped}${hash ? `#${hash}` : ""})`;
    return label;
  });
}

/** Split markdown into the text before the first `## ` heading and one block
 *  per `## ` section (heading included). Headings inside fenced code are not
 *  headings. */
export function splitSections(text) {
  const lines = text.split("\n");
  const blocks = [[]];
  let fenced = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && /^## /.test(line)) blocks.push([]);
    (blocks[blocks.length - 1] ?? []).push(line);
  }
  return blocks.map((b) => b.join("\n"));
}

/** AGENTS.md as the host guide. */
export function hostGuide(agents) {
  const [, ...sections] = splitSections(agents);
  const kept = [];
  for (const section of sections) {
    const heading = section.split("\n", 1)[0] ?? "";
    if (heading.includes("(for contributors")) continue;
    if (heading.startsWith("## Where to look for more")) {
      kept.push(MORE);
      continue;
    }
    kept.push(
      section.replace(/^## Anti-patterns to avoid in this codebase/, "## Anti-patterns to avoid"),
    );
  }
  const body = rewriteLinks(applyMarkers(`${INTRO}\n${kept.join("\n")}`), {
    "./docs/API.md": "./API.md",
    "./API.md": "./API.md",
    "./AESTHETICS.md": "./AESTHETICS.md",
  });
  return `${body.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

/** API.md and AESTHETICS.md as shipped beside the guide. */
export function shippedDoc(text) {
  return rewriteLinks(text, {
    "../AGENTS.md": "./GUIDE.md",
    "./AGENTS.md": "./GUIDE.md",
    "../AESTHETICS.md": "./AESTHETICS.md",
    "./AESTHETICS.md": "./AESTHETICS.md",
    "./docs/API.md": "./API.md",
    "./API.md": "./API.md",
  });
}

async function main() {
  const out = join(root, "dist", "guide");
  await mkdir(out, { recursive: true });
  const [agents, aesthetics, api] = await Promise.all(
    ["AGENTS.md", "AESTHETICS.md", join("docs", "API.md")].map((f) =>
      readFile(join(root, f), "utf8"),
    ),
  );
  await Promise.all([
    writeFile(join(out, "GUIDE.md"), hostGuide(agents)),
    writeFile(join(out, "AESTHETICS.md"), shippedDoc(aesthetics)),
    writeFile(join(out, "API.md"), shippedDoc(api)),
  ]);
  console.log("guide: wrote dist/guide/GUIDE.md, API.md, AESTHETICS.md");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
