import { describe, expect, it } from "vitest";
import { computeDropZone, dropZoneEqual, flatten } from "./dnd";
import type { ExplorerNode } from "./types";

// docs/ (folder, expanded)
//   guide.md
// src/ (folder, expanded)
//   index.ts
// README.md
const tree: ExplorerNode[] = [
  { id: "docs", name: "docs", children: [{ id: "docs/guide.md", name: "guide.md" }] },
  { id: "src", name: "src", children: [{ id: "src/index.ts", name: "index.ts" }] },
  { id: "README.md", name: "README.md" },
];
const flatRows = flatten(tree, new Set(["docs", "src"]));
// Flat order: docs(0), docs/guide.md(1), src(2), src/index.ts(3), README.md(4)
const readme = tree[2] as ExplorerNode;
const docs = tree[0] as ExplorerNode;

const zone = (rowIndex: number, yWithinRow: number, draggedNode: ExplorerNode = readme) =>
  computeDropZone({ draggedNode, flatRows, rowIndex, yWithinRow, rowHeight: 32 });

describe("computeDropZone", () => {
  it("top quarter resolves before the hovered row", () => {
    expect(zone(2, 3)).toEqual({ kind: "before", flatIndex: 2 });
  });

  it("bottom quarter resolves before the next row", () => {
    expect(zone(2, 30)).toEqual({ kind: "before", flatIndex: 3 });
  });

  it("folder middle resolves into the folder", () => {
    expect(zone(2, 16)).toEqual({ kind: "into", folderId: "src" });
  });

  it("file middle resolves before the file (no body to drop into)", () => {
    expect(zone(4, 16)).toEqual({ kind: "before", flatIndex: 4 });
  });

  it("quarter boundaries are exclusive (exactly 8px into a 32px row = middle)", () => {
    expect(zone(2, 8)).toEqual({ kind: "into", folderId: "src" });
    expect(zone(2, 24)).toEqual({ kind: "into", folderId: "src" });
  });

  it("rejects dropping a folder into itself", () => {
    expect(zone(0, 16, docs)).toBeNull();
  });

  it("rejects dropping a folder before its own child (cycle via parentId)", () => {
    expect(zone(1, 3, docs)).toBeNull();
  });

  it("allows dropping a folder before a sibling of its child's level", () => {
    expect(zone(3, 3, docs)).toEqual({ kind: "before", flatIndex: 3 });
  });

  it("returns null for an out-of-range row index", () => {
    expect(zone(99, 16)).toBeNull();
  });
});

describe("dropZoneEqual", () => {
  it("compares structurally per kind", () => {
    expect(dropZoneEqual(null, null)).toBe(true);
    expect(dropZoneEqual(null, { kind: "after-all" })).toBe(false);
    expect(dropZoneEqual({ kind: "after-all" }, { kind: "after-all" })).toBe(true);
    expect(dropZoneEqual({ kind: "before", flatIndex: 2 }, { kind: "before", flatIndex: 2 })).toBe(
      true,
    );
    expect(dropZoneEqual({ kind: "before", flatIndex: 2 }, { kind: "before", flatIndex: 3 })).toBe(
      false,
    );
    expect(dropZoneEqual({ kind: "into", folderId: "a" }, { kind: "into", folderId: "a" })).toBe(
      true,
    );
    expect(dropZoneEqual({ kind: "into", folderId: "a" }, { kind: "into", folderId: "b" })).toBe(
      false,
    );
    expect(dropZoneEqual({ kind: "into", folderId: "a" }, { kind: "before", flatIndex: 0 })).toBe(
      false,
    );
  });
});
