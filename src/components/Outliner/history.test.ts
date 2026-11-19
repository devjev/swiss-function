import { describe, expect, it } from "vitest";
import { History } from "./history";
import type { OutlinerValue } from "./types";

const v = (text: string): OutlinerValue => [{ id: "a", content: text }];
const state = (text: string, ui = text) => ({ value: v(text), ui });

describe("History", () => {
  it("undoes and redoes step by step", () => {
    const h = new History<string>();
    h.record(state("one"));
    h.record(state("two"));
    expect(h.undo(state("three"))?.ui).toBe("two");
    expect(h.undo(state("two"))?.ui).toBe("one");
    expect(h.undo(state("one"))).toBeNull();
    expect(h.redo(state("one"))?.ui).toBe("two");
    expect(h.redo(state("two"))?.ui).toBe("three");
    expect(h.redo(state("three"))).toBeNull();
  });

  it("a new change drops the redo steps", () => {
    const h = new History<string>();
    h.record(state("one"));
    h.undo(state("two"));
    h.record(state("one"));
    expect(h.redo(state("other"))).toBeNull();
  });

  it("joins keystrokes in one block into one step", () => {
    const h = new History<string>();
    h.record(state(""), { id: "a", now: 0 });
    h.record(state("h"), { id: "a", now: 200 });
    h.record(state("he"), { id: "a", now: 400 });
    expect(h.undo(state("hel"))?.ui).toBe("");
    expect(h.undo(state(""))).toBeNull();
  });

  it("a pause, another block, a structural step or a caret move ends the run", () => {
    const h = new History<string>();
    h.record(state("a"), { id: "a", now: 0 });
    h.record(state("b"), { id: "a", now: 1500 });
    h.record(state("c"), { id: "b", now: 1600 });
    h.record(state("d"));
    h.record(state("e"), { id: "b", now: 1700 });
    h.breakTyping();
    h.record(state("f"), { id: "b", now: 1800 });
    const seen: string[] = [];
    for (let s = h.undo(state("g")); s; s = h.undo(s)) seen.push(s.ui);
    expect(seen).toEqual(["f", "e", "d", "c", "b", "a"]);
  });

  it("keeps a bounded number of steps", () => {
    const h = new History<string>(3);
    for (const t of ["1", "2", "3", "4", "5"]) h.record(state(t));
    const seen: string[] = [];
    for (let s = h.undo(state("6")); s; s = h.undo(s)) seen.push(s.ui);
    expect(seen).toEqual(["5", "4", "3"]);
  });
});
