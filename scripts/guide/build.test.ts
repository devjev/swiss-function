import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyMarkers, hostGuide, rewriteLinks, shippedDoc, splitSections } from "./build.mjs";

const SAMPLE = `# AGENTS.md

Intro for the repo.

---

## What this library is

A library. See [docs/API.md](./docs/API.md) and [AESTHETICS.md](./AESTHETICS.md).

## Component catalogue

Quick reference. <!-- guide:skip -->Open Ladle (\`npm run dev\`).<!-- /guide:skip --><!-- guide:host Every prop is in [API.md](./docs/API.md). -->

\`\`\`md
## Not a heading, inside a fence
\`\`\`

## Anti-patterns to avoid in this codebase

Don't.

## File layout (for contributors)

src/ and so on.

## Issue workflow (for contributors: planning)

Issues.

## Where to look for more

- Live demos: \`npm run dev\`.
`;

describe("hostGuide", () => {
  const guide = hostGuide(SAMPLE);

  it("replaces the intro and keeps the host sections", () => {
    expect(guide.startsWith("# Using @tarassov-ch/swiss-function\n")).toBe(true);
    expect(guide).not.toContain("Intro for the repo.");
    expect(guide).toContain("## What this library is");
    expect(guide).toContain("## Component catalogue");
  });

  it("drops the contributor sections, and keeps a ## line inside a fence", () => {
    expect(guide).not.toContain("for contributors");
    expect(guide).not.toContain("src/ and so on.");
    expect(guide).not.toContain("Issues.");
    expect(guide).toContain("## Not a heading, inside a fence");
  });

  it("applies the markers", () => {
    expect(guide).not.toContain("Ladle");
    expect(guide).not.toContain("guide:");
    expect(guide).toContain("Quick reference. Every prop is in [API.md](./API.md).");
  });

  it("points the links at the shipped copies", () => {
    expect(guide).toContain("[docs/API.md](./API.md)");
    expect(guide).toContain("[AESTHETICS.md](./AESTHETICS.md)");
  });

  it("rewrites the closing section and the anti-patterns heading for a host", () => {
    expect(guide).not.toContain("npm run dev");
    expect(guide).toContain("## Where to look for more\n\n- **Props**: [API.md](./API.md)");
    expect(guide).toContain("## Anti-patterns to avoid\n");
  });
});

describe("helpers", () => {
  it("splits at ## headings outside fences", () => {
    expect(splitSections("a\n## One\nx\n```\n## no\n```\n## Two\ny")).toEqual([
      "a",
      "## One\nx\n```\n## no\n```",
      "## Two\ny",
    ]);
  });

  it("removes skip spans across lines and unwraps host text", () => {
    expect(
      applyMarkers("a <!-- guide:skip -->b\nc<!-- /guide:skip -->d <!-- guide:host e -->"),
    ).toBe("a d e");
  });

  it("maps known links, unlinks other relative ones, leaves URLs and anchors", () => {
    expect(
      rewriteLinks("[a](./x.md#p) [b](./docs/research/y.md) [c](https://e.org) [d](#top)", {
        "./x.md": "./X.md",
      }),
    ).toBe("[a](./X.md#p) b [c](https://e.org) [d](#top)");
  });

  it("points the shipped reference at the guide and its neighbour", () => {
    expect(shippedDoc("see [AGENTS.md](../AGENTS.md) and [A](../AESTHETICS.md)")).toBe(
      "see [AGENTS.md](./GUIDE.md) and [A](./AESTHETICS.md)",
    );
  });
});

describe("the real AGENTS.md", () => {
  const guide = hostGuide(readFileSync(join(__dirname, "..", "..", "AGENTS.md"), "utf8"));

  it("leaves nothing that only makes sense inside the library's repository", () => {
    for (const text of ["for contributors", "npm run", "Ladle", "guide:", "src/tokens", "?grid"]) {
      expect(guide, text).not.toContain(text);
    }
  });

  it("keeps the host sections", () => {
    for (const heading of [
      "## What this library is",
      "## Setup",
      "## Component catalogue",
      "## Conventions",
      "## When the user asks for X, reach for Y",
      "## Anti-patterns to avoid",
      "## Where to look for more",
    ]) {
      expect(guide, heading).toContain(`\n${heading}\n`);
    }
  });

  it("links only to the shipped files", () => {
    const targets = [...guide.matchAll(/\]\((\.[^)]+)\)/g)].map((m) => m[1]?.split("#")[0]);
    for (const t of targets) expect(["./API.md", "./AESTHETICS.md"], t).toContain(t);
  });
});
