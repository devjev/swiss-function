import { describe, expect, it } from "vitest";
import { type CellBackground, resolveCellBackground } from "./types";

describe("resolveCellBackground", () => {
  it("takes a bare colour string as the fill, leaving the ink to pick itself", () => {
    expect(resolveCellBackground("var(--sf-color-success)")).toEqual({
      color: "var(--sf-color-success)",
    });
    expect(resolveCellBackground("#fee")).toEqual({ color: "#fee" });
  });

  it("carries an explicitly pinned text colour", () => {
    expect(resolveCellBackground({ color: "#111", textColor: "#fff" })).toEqual({
      color: "#111",
      textColor: "#fff",
    });
  });

  it("omits the text colour when the object does not pin one", () => {
    const out = resolveCellBackground({ color: "#111" });
    expect(out).toEqual({ color: "#111" });
    expect(out && "textColor" in out).toBe(false);
  });

  it("paints nothing for an absent or empty colour", () => {
    expect(resolveCellBackground(undefined)).toBeNull();
    expect(resolveCellBackground("")).toBeNull();
    expect(resolveCellBackground({ color: "" })).toBeNull();
  });

  it("accepts every documented shape under the public type", () => {
    const shapes: CellBackground[] = [
      "red",
      { color: "red" },
      { color: "red", textColor: "white" },
    ];
    expect(shapes.map((s) => resolveCellBackground(s)?.color)).toEqual(["red", "red", "red"]);
  });
});
