import { describe, expect, it } from "vitest";
import type { ColumnDef } from "./types";
import { expandPlaceholderOrder, placeholderId, toEffectiveOrder } from "./useColumnGroupCollapse";

type Row = { v: string };

// Name | Address(street, city, zip) | Age — the canonical group fixture.
const columns: ColumnDef<Row>[] = [
  { id: "name", header: "Name", accessor: "v" },
  {
    id: "address",
    header: "Address",
    columns: [
      { id: "street", header: "Street", accessor: "v" },
      { id: "city", header: "City", accessor: "v" },
      { id: "zip", header: "Zip", accessor: "v" },
    ],
  },
  { id: "age", header: "Age", accessor: "v" },
];

// Outer(a, Inner(b, c)) | d — for nested-group cases.
const nested: ColumnDef<Row>[] = [
  {
    id: "outer",
    header: "Outer",
    columns: [
      { id: "a", header: "A", accessor: "v" },
      {
        id: "inner",
        header: "Inner",
        columns: [
          { id: "b", header: "B", accessor: "v" },
          { id: "c", header: "C", accessor: "v" },
        ],
      },
    ],
  },
  { id: "d", header: "D", accessor: "v" },
];

const pl = placeholderId;

describe("expandPlaceholderOrder", () => {
  it("replaces a placeholder id with the group's leaf ids in definition order", () => {
    expect(expandPlaceholderOrder([pl("address"), "name", "age"], columns)).toEqual([
      "street",
      "city",
      "zip",
      "name",
      "age",
    ]);
  });

  it("keeps the leaves' prior relative order from the previous column order", () => {
    expect(
      expandPlaceholderOrder([pl("address"), "name", "age"], columns, [
        "zip",
        "street",
        "name",
        "city",
        "age",
      ]),
    ).toEqual(["zip", "street", "city", "name", "age"]);
  });

  it("passes an order with no placeholders through unchanged", () => {
    const order = ["age", "name", "street", "city", "zip"];
    expect(expandPlaceholderOrder(order, columns)).toEqual(order);
  });

  it("dedupes when the order carries both a placeholder and one of its leaves", () => {
    expect(expandPlaceholderOrder([pl("address"), "street", "name"], columns)).toEqual([
      "street",
      "city",
      "zip",
      "name",
    ]);
  });

  it("expands a nested group's placeholder to its whole subtree", () => {
    expect(expandPlaceholderOrder(["d", pl("outer")], nested)).toEqual(["d", "a", "b", "c"]);
    expect(expandPlaceholderOrder(["a", pl("inner"), "d"], nested)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("toEffectiveOrder", () => {
  it("collapses a group's leaf ids to one placeholder at the first leaf's position", () => {
    expect(
      toEffectiveOrder(["street", "name", "city", "zip", "age"], columns, { address: true }),
    ).toEqual([pl("address"), "name", "age"]);
  });

  it("leaves the order alone when nothing is collapsed", () => {
    const order = ["street", "name", "city", "zip", "age"];
    expect(toEffectiveOrder(order, columns, {})).toEqual(order);
    expect(toEffectiveOrder(order, columns, { address: false })).toEqual(order);
  });

  it("maps a nested subtree to the outermost collapsed ancestor", () => {
    expect(toEffectiveOrder(["b", "a", "c", "d"], nested, { outer: true, inner: true })).toEqual([
      pl("outer"),
      "d",
    ]);
    expect(toEffectiveOrder(["a", "b", "c", "d"], nested, { inner: true })).toEqual([
      "a",
      pl("inner"),
      "d",
    ]);
  });
});

describe("reorder-while-collapsed then expand (issue: group jumped to the tail)", () => {
  it("keeps the group's leaves at the dragged position through collapse and expand", () => {
    // Collapsed effective order after dragging the placeholder to the front.
    const draggedEffective = [pl("address"), "name", "age"];
    // What the table persists: real leaf ids only.
    const persisted = expandPlaceholderOrder(draggedEffective, columns, []);
    expect(persisted).toEqual(["street", "city", "zip", "name", "age"]);
    // While still collapsed, the placeholder stays at the dragged position.
    expect(toEffectiveOrder(persisted, columns, { address: true })).toEqual(draggedEffective);
    // After expanding, the real leaves hold that position (no tail jump).
    expect(toEffectiveOrder(persisted, columns, {})).toEqual(persisted);
  });
});
