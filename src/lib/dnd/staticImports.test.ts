// Guard for issue #93: the drag widgets load dnd-kit only when a drag feature
// is on. Each entry's static import graph (relative imports followed through
// first-party source, dynamic `import()` left out) must reach no `@dnd-kit/*`
// module by value. Type-only imports (`import type`, `export type`) are erased
// and do not count; `import { type X }` does count, because under
// `verbatimModuleSyntax` it compiles to a side-effect import of the module.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The value imports and re-exports of one source text, by specifier. */
function valueSpecifiers(text: string): string[] {
  const source = ts.createSourceFile("module.tsx", text, ts.ScriptTarget.Latest);
  const out: string[] = [];
  for (const node of source.statements) {
    if (ts.isImportDeclaration(node)) {
      if (node.importClause?.isTypeOnly) continue;
      if (ts.isStringLiteral(node.moduleSpecifier)) out.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node)) {
      if (node.isTypeOnly || !node.moduleSpecifier) continue;
      if (ts.isStringLiteral(node.moduleSpecifier)) out.push(node.moduleSpecifier.text);
    }
  }
  return out;
}

/** Resolve a relative specifier to a TypeScript source file, or `null` for a
 *  stylesheet or another non-script asset. */
function resolveSource(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    base,
  ]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every `@dnd-kit/*` value import reachable from `entry`, each with the chain
 *  of files that leads to it. */
function dndKitReach(entry: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const queue: { file: string; chain: string[] }[] = [{ file: entry, chain: [] }];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || seen.has(next.file)) continue;
    seen.add(next.file);
    const chain = [...next.chain, relative(SRC, next.file)];
    for (const spec of valueSpecifiers(readFileSync(next.file, "utf8"))) {
      if (spec.startsWith(".")) {
        const target = resolveSource(next.file, spec);
        if (target) queue.push({ file: target, chain });
      } else if (spec.startsWith("@dnd-kit/")) {
        found.push(`${chain.join(" -> ")} -> ${spec}`);
      }
    }
  }
  return found;
}

const WIDGETS = [
  "components/DataTable/index.ts",
  "components/Explorer/index.ts",
  "components/WindowArray/index.ts",
  "components/TableInput/index.ts",
  "components/ContextEditor/index.ts",
  "components/AgentComposer/index.ts",
  "components/Outliner/index.ts",
];

describe("drag widgets load dnd-kit lazily", () => {
  it.each(WIDGETS)("%s reaches no @dnd-kit module statically", (entry) => {
    expect(dndKitReach(join(SRC, entry))).toEqual([]);
  });

  it("the walk finds dnd-kit where it is imported statically", () => {
    // A control: the provider imports dnd-kit at module top.
    expect(dndKitReach(join(SRC, "lib/dnd/SfDndProvider.tsx")).length).toBeGreaterThan(0);
  });

  it("skips type-only imports and dynamic imports, and keeps the rest", () => {
    const text = [
      'import type { Active } from "@dnd-kit/core";',
      'export type { Over } from "@dnd-kit/core";',
      'import { type DragEndEvent } from "@dnd-kit/sortable";',
      'import "./side-effect";',
      'export * from "./barrel";',
      'const lazy = () => import("./Lazy");',
    ].join("\n");
    expect(valueSpecifiers(text)).toEqual(["@dnd-kit/sortable", "./side-effect", "./barrel"]);
  });
});
