import { describe, expect, it } from "vitest";
import {
  type ActiveFilter,
  checklistTest,
  collectKeptFolderIds,
  filterTree,
  makeComparator,
  naturalCompare,
  rangeTest,
  readCellValue,
  sortTree,
} from "./transform";
import type { ExplorerNode } from "./types";

type Meta = { size?: number; kind?: string };

// A small fixture: two folders (each with files) + a root file.
const tree = (): ExplorerNode<Meta>[] => [
  {
    id: "src",
    name: "src",
    children: [
      { id: "b.ts", name: "b.ts", meta: { size: 30, kind: "ts" } },
      { id: "a.ts", name: "a.ts", meta: { size: 10, kind: "ts" } },
      { id: "img.png", name: "img.png", meta: { size: 20, kind: "png" } },
    ],
  },
  {
    id: "docs",
    name: "docs",
    children: [{ id: "readme.md", name: "readme.md", meta: { size: 5, kind: "md" } }],
  },
  { id: "root.txt", name: "root.txt", meta: { size: 1, kind: "txt" } },
];

const byName =
  <M>() =>
  (n: ExplorerNode<M>) =>
    n.name;
const bySize = (n: ExplorerNode<Meta>) => n.meta?.size;

describe("readCellValue", () => {
  it("reads meta[col.id] by default", () => {
    expect(readCellValue({ id: "size", header: "Size" }, tree()[0]!.children![0]!)).toBe(30);
  });
  it("prefers an explicit accessor", () => {
    expect(readCellValue({ id: "x", header: "X", accessor: (n) => n.name }, tree()[2]!)).toBe(
      "root.txt",
    );
  });
});

describe("sortTree", () => {
  it("is identity for a null comparator (same reference)", () => {
    const t = tree();
    expect(sortTree(t, null, true)).toBe(t);
  });

  it("sorts each sibling group, folders first, hierarchy preserved", () => {
    const sorted = sortTree(tree(), makeComparator(byName<Meta>(), "asc"), true);
    // Top level: folders (docs, src) before file (root.txt).
    expect(sorted.map((n) => n.id)).toEqual(["docs", "src", "root.txt"]);
    // src's children sorted by name.
    expect(sorted[1]!.children!.map((n) => n.id)).toEqual(["a.ts", "b.ts", "img.png"]);
  });

  it("sorts numerically by a metadata accessor, descending", () => {
    const sorted = sortTree(tree(), makeComparator(bySize, "desc"), true);
    // Folders (src, docs) have no size → they stay first in stable order, so
    // src is index 0; its children sort by size desc.
    expect(sorted[0]!.children!.map((n) => n.meta?.size)).toEqual([30, 20, 10]);
  });

  it("uses natural order so file2 precedes file10", () => {
    const nodes: ExplorerNode<Meta>[] = [
      { id: "10", name: "file10" },
      { id: "2", name: "file2" },
    ];
    const sorted = sortTree(nodes, makeComparator(byName<Meta>(), "asc"), false);
    expect(sorted.map((n) => n.name)).toEqual(["file2", "file10"]);
  });

  it("puts nullish values last in both directions", () => {
    const nodes: ExplorerNode<Meta>[] = [
      { id: "a", name: "a", meta: { size: 5 } },
      { id: "b", name: "b", meta: {} },
      { id: "c", name: "c", meta: { size: 2 } },
    ];
    const asc = sortTree(nodes, makeComparator(bySize, "asc"), false).map((n) => n.id);
    const desc = sortTree(nodes, makeComparator(bySize, "desc"), false).map((n) => n.id);
    expect(asc).toEqual(["c", "a", "b"]); // 2, 5, null
    expect(desc).toEqual(["a", "c", "b"]); // 5, 2, null (null still last)
  });
});

describe("naturalCompare", () => {
  // Pins the checklist-option ordering Explorer's filter funnels show (the
  // distinct-values sort uses naturalCompare directly).
  it("sorts checklist options in natural order", () => {
    const options = ["file10", "readme.md", "file2", "a.ts", "file1", "b.ts"];
    expect([...options].sort(naturalCompare)).toEqual([
      "a.ts",
      "b.ts",
      "file1",
      "file2",
      "file10",
      "readme.md",
    ]);
  });

  it("orders exactly like per-call localeCompare with { numeric: true }", () => {
    const names = ["node-n-1-x2", "node-n-0-9", "file10.ts", "file2.ts", "img.png", "a", "10", "2"];
    expect([...names].sort(naturalCompare)).toEqual(
      [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    );
  });
});

describe("filterTree", () => {
  it("is identity with no filters (same reference)", () => {
    const t = tree();
    expect(filterTree(t, [])).toBe(t);
  });

  it("keeps ancestors of a match and prunes non-matches", () => {
    const f: ActiveFilter<Meta> = { read: bySize, test: rangeTest([15, undefined]) };
    const out = filterTree(tree(), [f]);
    // Only b.ts(30) and img.png(20) qualify → src kept (with those two),
    // docs(5) and root.txt(1) dropped.
    expect(out.map((n) => n.id)).toEqual(["src"]);
    expect(out[0]!.children!.map((n) => n.id).sort()).toEqual(["b.ts", "img.png"]);
  });

  it("keeps a direct match's whole subtree", () => {
    // Match the folder "src" by name → its full subtree is retained intact.
    const f: ActiveFilter<Meta> = { read: byName<Meta>(), test: checklistTest(["src"]) };
    const out = filterTree(tree(), [f]);
    expect(out.map((n) => n.id)).toEqual(["src"]);
    expect(out[0]!.children!.map((n) => n.id)).toEqual(["b.ts", "a.ts", "img.png"]);
  });

  it("applies multiple filters conjunctively", () => {
    const filters: ActiveFilter<Meta>[] = [
      { read: (n) => n.meta?.kind, test: checklistTest(["ts"]) },
      { read: bySize, test: rangeTest([undefined, 15]) },
    ];
    const out = filterTree(tree(), filters);
    // ts AND size<=15 → only a.ts(10).
    expect(out.map((n) => n.id)).toEqual(["src"]);
    expect(out[0]!.children!.map((n) => n.id)).toEqual(["a.ts"]);
  });
});

describe("predicates", () => {
  it("checklistTest keeps everything when the allow-list is empty", () => {
    expect(checklistTest([])("anything")).toBe(true);
    expect(checklistTest(undefined)("anything")).toBe(true);
  });
  it("rangeTest honours open bounds", () => {
    expect(rangeTest([10, undefined])(10)).toBe(true);
    expect(rangeTest([10, undefined])(9)).toBe(false);
    expect(rangeTest([undefined, 10])(11)).toBe(false);
    expect(rangeTest(undefined)(123)).toBe(true);
  });
});

describe("collectKeptFolderIds", () => {
  it("returns every folder id in the forest", () => {
    expect([...collectKeptFolderIds(tree())].sort()).toEqual(["docs", "src"]);
  });
});
