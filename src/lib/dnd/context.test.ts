import { describe, expect, it } from "vitest";
import { regionIdOf, routeDragEnd, SF_REGION_KEY } from "./context";

describe("regionIdOf", () => {
  it("reads a stamped region id", () => {
    expect(regionIdOf({ data: { current: { [SF_REGION_KEY]: "r1" } } })).toBe("r1");
  });

  it("returns null for a foreign / unstamped item", () => {
    expect(regionIdOf({ data: { current: { columnId: "c" } } })).toBeNull();
    expect(regionIdOf({ data: { current: undefined } })).toBeNull();
    expect(regionIdOf(null)).toBeNull();
    expect(regionIdOf(undefined)).toBeNull();
  });

  it("ignores a non-string region id", () => {
    expect(
      regionIdOf({ data: { current: { [SF_REGION_KEY]: 42 as unknown as string } } }),
    ).toBeNull();
  });
});

describe("routeDragEnd", () => {
  const has = (...ids: string[]) => {
    const set = new Set(ids);
    return (id: string) => set.has(id);
  };

  it("routes a region's own drag as internal when it stays in-region", () => {
    // over nothing — the region's own append / cleanup case
    expect(routeDragEnd("r1", null, has("r1"))).toEqual({ kind: "internal", regionId: "r1" });
    // over its own region
    expect(routeDragEnd("r1", "r1", has("r1"))).toEqual({ kind: "internal", regionId: "r1" });
    // over a droppable with no region (a bare host target) — still internal
    expect(routeDragEnd("r1", "host-drop", has("r1"))).toEqual({
      kind: "internal",
      regionId: "r1",
    });
  });

  it("routes a drop over a DIFFERENT registered region as external to the target", () => {
    // A row dragged out of one widget onto another: the target's onExternalDrop
    // handles it, the source's internal reorder never sees a foreign target.
    expect(routeDragEnd("r1", "r2", has("r1", "r2"))).toEqual({ kind: "external", regionId: "r2" });
  });

  it("routes a foreign item dropped over a region as external to that region", () => {
    expect(routeDragEnd(null, "r2", has("r1", "r2"))).toEqual({ kind: "external", regionId: "r2" });
  });

  it("is unclaimed when neither side is a registered region", () => {
    expect(routeDragEnd(null, null, has("r1"))).toEqual({ kind: "none" });
    // a foreign item over another foreign droppable
    expect(routeDragEnd(null, "host-drop", has("r1"))).toEqual({ kind: "none" });
  });

  it("treats an active id from an unregistered region as foreign", () => {
    // The region unmounted mid-drag: fall through rather than dispatch to a
    // missing handler.
    expect(routeDragEnd("gone", "r2", has("r2"))).toEqual({ kind: "external", regionId: "r2" });
    expect(routeDragEnd("gone", null, has("r2"))).toEqual({ kind: "none" });
  });
});
