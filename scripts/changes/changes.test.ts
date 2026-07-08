import { describe, expect, it } from "vitest";
import {
  aggregateBump,
  incrementVersion,
  parseChangeset,
  renderChangelogSection,
  slugify,
} from "./changes.mjs";

describe("parseChangeset", () => {
  it("reads the bump from frontmatter and trims the note", () => {
    expect(parseChangeset("---\nbump: minor\n---\nAdd the Form primitives.\n")).toEqual({
      bump: "minor",
      note: "Add the Form primitives.",
    });
  });

  it("returns a null bump when there is no frontmatter", () => {
    expect(parseChangeset("just a note").bump).toBeNull();
  });
});

describe("aggregateBump", () => {
  it("returns the highest-ranked bump", () => {
    expect(aggregateBump(["patch", "major", "minor"])).toBe("major");
    expect(aggregateBump(["patch", "minor"])).toBe("minor");
    expect(aggregateBump(["patch", "patch"])).toBe("patch");
  });

  it("ignores unknown bumps and returns null when empty", () => {
    expect(aggregateBump([])).toBeNull();
    expect(aggregateBump(["nonsense", null])).toBeNull();
    expect(aggregateBump(["nonsense", "minor"])).toBe("minor");
  });
});

describe("incrementVersion", () => {
  it("applies semver bumps", () => {
    expect(incrementVersion("1.15.2", "patch")).toBe("1.15.3");
    expect(incrementVersion("1.15.2", "minor")).toBe("1.16.0");
    expect(incrementVersion("1.15.2", "major")).toBe("2.0.0");
  });

  it("throws on an unparseable version", () => {
    expect(() => incrementVersion("nope", "patch")).toThrow();
  });
});

describe("slugify", () => {
  it("kebab-cases and caps length", () => {
    expect(slugify("Add the Form composition primitives!")).toBe(
      "add-the-form-composition-primitives",
    );
    expect(slugify("!!!")).toBe("change");
  });
});

describe("renderChangelogSection", () => {
  it("groups entries by bump, newest bump first", () => {
    const section = renderChangelogSection("1.16.0", "2026-07-08", [
      { bump: "minor", note: "Add Form." },
      { bump: "patch", note: "Fix a bug." },
    ]);
    expect(section).toContain("## v1.16.0 — 2026-07-08");
    expect(section).toContain("### Minor\n\n- Add Form.");
    expect(section).toContain("### Patch\n\n- Fix a bug.");
    // Minor precedes Patch.
    expect(section.indexOf("Minor")).toBeLessThan(section.indexOf("Patch"));
  });
});
