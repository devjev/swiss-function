import { describe, expect, it } from "vitest";
import { History } from "./history";
import { keyboardInset, structureMoves } from "./toolbar";
import { flatVisible, indent, moveDown, moveUp, outdent } from "./tree";
import type { OutlinerValue } from "./types";
import { zoomBack, zoomView } from "./zoom";

describe("keyboardInset", () => {
  it("is 0 without the Visual Viewport API", () => {
    expect(keyboardInset(844, null)).toBe(0);
    expect(keyboardInset(844, undefined)).toBe(0);
  });

  it("is 0 while the whole layout viewport is visible", () => {
    expect(keyboardInset(844, { offsetTop: 0, height: 844 })).toBe(0);
  });

  it("is the height the keyboard covers", () => {
    // A 336px keyboard over an 844px window.
    expect(keyboardInset(844, { offsetTop: 0, height: 508 })).toBe(336);
  });

  it("follows the visible part when the page pans under the keyboard", () => {
    // iOS scrolls the visual viewport down to keep the caret in sight: the
    // visible part then ends lower, and less is hidden under it.
    expect(keyboardInset(844, { offsetTop: 120, height: 508 })).toBe(216);
    expect(keyboardInset(844, { offsetTop: 336, height: 508 })).toBe(0);
  });

  it("never goes below 0", () => {
    // A layout viewport that shrank with the keyboard (Android,
    // `interactive-widget=resizes-content`) before the visual one reported it.
    expect(keyboardInset(508, { offsetTop: 0, height: 844 })).toBe(0);
    expect(keyboardInset(844, { offsetTop: 400, height: 508 })).toBe(0);
  });

  it("rounds to a whole pixel", () => {
    expect(keyboardInset(844, { offsetTop: 0, height: 507.6 })).toBe(336);
    expect(keyboardInset(844, { offsetTop: 0.2, height: 843.9 })).toBe(0);
  });

  it("is 0 for values that are not numbers", () => {
    expect(keyboardInset(Number.NaN, { offsetTop: 0, height: 500 })).toBe(0);
    expect(keyboardInset(844, { offsetTop: 0, height: Number.NaN })).toBe(0);
  });
});

const tree: OutlinerValue = [
  {
    id: "a",
    content: "A",
    children: [
      { id: "a1", content: "A.1" },
      {
        id: "a2",
        content: "A.2",
        children: [
          { id: "a2x", content: "A.2.x" },
          { id: "a2y", content: "A.2.y" },
        ],
      },
      { id: "a3", content: "A.3" },
    ],
  },
  { id: "b", content: "B", children: [{ id: "b1", content: "B.1" }] },
  { id: "c", content: "C", collapsed: true, children: [{ id: "c1", content: "C.1" }] },
  { id: "d", content: "D" },
];

describe("structureMoves", () => {
  it("answers for the outline's edges", () => {
    const rows = flatVisible(tree);
    const of = (id: string) =>
      structureMoves(
        rows,
        rows.findIndex((r) => r.id === id),
        false,
      );
    // The first block: nowhere to go but down.
    expect(of("a")).toEqual({ outdent: false, indent: false, moveUp: false, moveDown: true });
    // A first child of the first block: it cannot rise into a previous parent.
    expect(of("a1")).toEqual({ outdent: true, indent: false, moveUp: false, moveDown: true });
    // A last child whose parent has a next sibling crosses into it.
    expect(of("a3")).toEqual({ outdent: true, indent: true, moveUp: true, moveDown: true });
    // An only child of a later block rises into the previous one.
    expect(of("b1")).toEqual({ outdent: true, indent: false, moveUp: true, moveDown: true });
    // The last block.
    expect(of("d")).toEqual({ outdent: false, indent: true, moveUp: true, moveDown: false });
  });

  it("is all false for a row that is not there", () => {
    expect(structureMoves(flatVisible(tree), -1, false)).toEqual({
      outdent: false,
      indent: false,
      moveUp: false,
      moveDown: false,
    });
  });

  it("agrees with the tree operations on every visible block", () => {
    const rows = flatVisible(tree);
    rows.forEach((row, at) => {
      expect(structureMoves(rows, at, false), row.id).toEqual({
        outdent: outdent(tree, row.id) !== tree,
        indent: indent(tree, row.id) !== tree,
        moveUp: moveUp(tree, row.id) !== tree,
        moveDown: moveDown(tree, row.id) !== tree,
      });
    });
  });

  it("agrees with them while zoomed, where a block may not leave the title", () => {
    const root = tree[0];
    if (!root) throw new Error("no root");
    const view = zoomView(root);
    const rows = flatVisible(view);
    const stays = (next: OutlinerValue) => next !== view && zoomBack(tree, root, next) !== null;
    rows.forEach((row, at) => {
      expect(structureMoves(rows, at, true), row.id).toEqual({
        outdent: stays(outdent(view, row.id)),
        indent: stays(indent(view, row.id)),
        moveUp: stays(moveUp(view, row.id)),
        moveDown: stays(moveDown(view, row.id)),
      });
    });
    // The title's own children do not outdent; their children do.
    expect(structureMoves(rows, 1, true).outdent).toBe(false);
    expect(structureMoves(rows, 3, true).outdent).toBe(true);
  });
});

describe("History.canUndo / canRedo", () => {
  const state = (text: string) => ({ value: [{ id: "a", content: text }], ui: text });

  it("follow the two stacks", () => {
    const h = new History<string>();
    expect([h.canUndo, h.canRedo]).toEqual([false, false]);
    h.record(state("one"));
    expect([h.canUndo, h.canRedo]).toEqual([true, false]);
    h.undo(state("two"));
    expect([h.canUndo, h.canRedo]).toEqual([false, true]);
    h.redo(state("one"));
    expect([h.canUndo, h.canRedo]).toEqual([true, false]);
    h.clear();
    expect([h.canUndo, h.canRedo]).toEqual([false, false]);
  });
});
