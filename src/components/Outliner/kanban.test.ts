import { describe, expect, it } from "vitest";
import { cardTarget } from "./kanban";
import type { Bullet } from "./types";

const COLUMNS: Bullet[] = [
  {
    id: "todo",
    content: "To do",
    children: [
      { id: "a", content: "A" },
      { id: "b", content: "B" },
      { id: "c", content: "C" },
    ],
  },
  { id: "doing", content: "Doing", children: [{ id: "d", content: "D" }] },
  { id: "done", content: "Done" },
];

describe("cardTarget", () => {
  it("a card dragged down its column lands after the card it is over", () => {
    expect(cardTarget(COLUMNS, "a", { columnId: "todo", cardId: "c" })).toEqual({
      columnId: "todo",
      afterId: "c",
    });
  });

  it("a card dragged up takes the place of the card it is over", () => {
    expect(cardTarget(COLUMNS, "c", { columnId: "todo", cardId: "b" })).toEqual({
      columnId: "todo",
      afterId: "a",
    });
    expect(cardTarget(COLUMNS, "c", { columnId: "todo", cardId: "a" })).toEqual({
      columnId: "todo",
      afterId: null,
    });
  });

  it("over a card of another column it goes before that card", () => {
    expect(cardTarget(COLUMNS, "a", { columnId: "doing", cardId: "d" })).toEqual({
      columnId: "doing",
      afterId: null,
    });
  });

  it("over a column it goes last, also in an empty one", () => {
    expect(cardTarget(COLUMNS, "a", { columnId: "doing", cardId: null })).toEqual({
      columnId: "doing",
      afterId: "d",
    });
    expect(cardTarget(COLUMNS, "a", { columnId: "done", cardId: null })).toEqual({
      columnId: "done",
      afterId: null,
    });
    expect(cardTarget(COLUMNS, "c", { columnId: "todo", cardId: null })).toEqual({
      columnId: "todo",
      afterId: "b",
    });
  });

  it("over itself, or over nothing known, it stays", () => {
    expect(cardTarget(COLUMNS, "a", { columnId: "todo", cardId: "a" })).toBeNull();
    expect(cardTarget(COLUMNS, "a", { columnId: "gone", cardId: null })).toBeNull();
  });
});
