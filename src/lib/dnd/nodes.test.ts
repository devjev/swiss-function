import { arrayMove as dndKitArrayMove } from "@dnd-kit/sortable";
import { describe, expect, it } from "vitest";
import { arrayMove, DragNodes } from "./nodes";

describe("DragNodes", () => {
  const el = (name: string) => ({ name }) as unknown as HTMLElement;

  it("hands a bound sink the element that mounted before the binding", () => {
    const nodes = new DragNodes();
    const seen: unknown[] = [];
    nodes.attach("a", el("a1"));
    nodes.bind("a", (node) => seen.push(node));
    expect(seen).toEqual([el("a1")]);
  });

  it("hands a bound sink the element that mounts after the binding, and its unmount", () => {
    const nodes = new DragNodes();
    const seen: unknown[] = [];
    nodes.bind("a", (node) => seen.push(node));
    nodes.attach("a", el("a1"));
    nodes.attach("a", null);
    expect(seen).toEqual([null, el("a1"), null]);
  });

  it("ends a binding with null and stops forwarding", () => {
    const nodes = new DragNodes();
    const seen: unknown[] = [];
    nodes.attach("a", el("a1"));
    const unbind = nodes.bind("a", (node) => seen.push(node));
    unbind();
    nodes.attach("a", el("a2"));
    expect(seen).toEqual([el("a1"), null]);
  });

  it("keeps a newer binding when an older one for the same key ends", () => {
    const nodes = new DragNodes();
    const older: unknown[] = [];
    const newer: unknown[] = [];
    const unbindOlder = nodes.bind("a", (node) => older.push(node));
    nodes.bind("a", (node) => newer.push(node));
    unbindOlder();
    nodes.attach("a", el("a1"));
    expect(newer).toEqual([null, el("a1")]);
  });

  it("dispatches to the bound listener for an event, and to nothing once dropped", () => {
    const nodes = new DragNodes();
    const calls: unknown[] = [];
    nodes.dispatch("a", "onPointerDown", "early");
    nodes.setListeners("a", { onPointerDown: (e: unknown) => calls.push(e) });
    nodes.dispatch("a", "onPointerDown", "press");
    nodes.dispatch("a", "onTouchStart", "touch");
    nodes.setListeners("a", undefined);
    nodes.dispatch("a", "onPointerDown", "late");
    expect(calls).toEqual(["press"]);
  });
});

describe("arrayMove", () => {
  it("matches dnd-kit's arrayMove", () => {
    const items = ["a", "b", "c", "d", "e"];
    for (let from = 0; from < items.length; from++) {
      for (let to = -2; to < items.length; to++) {
        expect(arrayMove(items, from, to)).toEqual(dndKitArrayMove(items, from, to));
      }
    }
  });

  it("leaves the input untouched", () => {
    const items = ["a", "b", "c"];
    arrayMove(items, 0, 2);
    expect(items).toEqual(["a", "b", "c"]);
  });
});
