import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MARK, parseArgs, run } from "./guide.mjs";

const GUIDE = "# Using it\n\nSee [API.md](./API.md) and [AESTHETICS.md](./AESTHETICS.md).\n";

/** A host project with the package installed in its node_modules, built. */
function makeHost() {
  const host = mkdtempSync(join(tmpdir(), "sf-guide-"));
  const pkgDir = join(host, "node_modules", "@tarassov-ch", "swiss-function");
  mkdirSync(join(pkgDir, "dist", "guide"), { recursive: true });
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify({
      name: "@tarassov-ch/swiss-function",
      version: "9.9.9",
      exports: { "./package.json": "./package.json" },
    }),
  );
  writeFileSync(join(pkgDir, "dist", "guide", "GUIDE.md"), GUIDE);
  return { host, pkgDir };
}

let host: string;
let pkgDir: string;
let printed: string[];
let errors: string[];

const go = (argv: string[], cwd = host) =>
  run(argv, {
    cwd,
    pkgDir,
    out: (t: string) => printed.push(t),
    err: (t: string) => errors.push(t),
  });

beforeEach(() => {
  ({ host, pkgDir } = makeHost());
  printed = [];
  errors = [];
});
afterEach(() => rmSync(host, { recursive: true, force: true }));

describe("guide", () => {
  it("writes SWISS-FUNCTION.md with the mark, the version and links into the package", async () => {
    expect(await go(["guide"])).toBe(0);
    const text = readFileSync(join(host, "SWISS-FUNCTION.md"), "utf8");
    expect(text.startsWith(MARK)).toBe(true);
    expect(text.split("\n", 1)[0]).toContain("@tarassov-ch/swiss-function 9.9.9");
    expect(text).toContain(
      "[API.md](./node_modules/@tarassov-ch/swiss-function/dist/guide/API.md)",
    );
    expect(text).toContain(
      "[AESTHETICS.md](./node_modules/@tarassov-ch/swiss-function/dist/guide/AESTHETICS.md)",
    );
  });

  it("points the links from where the guide is written", async () => {
    expect(await go(["guide", "--out", "docs/ui/swiss.md"])).toBe(0);
    const text = readFileSync(join(host, "docs", "ui", "swiss.md"), "utf8");
    expect(text).toContain(
      "[API.md](../../node_modules/@tarassov-ch/swiss-function/dist/guide/API.md)",
    );
  });

  it("overwrites its own file, and no other without --force", async () => {
    await go(["guide"]);
    expect(await go(["guide"])).toBe(0);
    writeFileSync(join(host, "SWISS-FUNCTION.md"), "my own notes\n");
    expect(await go(["guide"])).toBe(1);
    expect(errors.join("")).toContain("--force");
    expect(readFileSync(join(host, "SWISS-FUNCTION.md"), "utf8")).toBe("my own notes\n");
    expect(await go(["guide", "--force"])).toBe(0);
    expect(readFileSync(join(host, "SWISS-FUNCTION.md"), "utf8").startsWith(MARK)).toBe(true);
  });

  it("--link adds one reference to AGENTS.md and an import to CLAUDE.md, once", async () => {
    writeFileSync(join(host, "AGENTS.md"), "# Agents\n\nRules.\n");
    writeFileSync(join(host, "CLAUDE.md"), "# Claude\n");
    expect(await go(["guide", "--link"])).toBe(0);
    expect(await go(["guide", "--link"])).toBe(0);
    const agents = readFileSync(join(host, "AGENTS.md"), "utf8");
    const claude = readFileSync(join(host, "CLAUDE.md"), "utf8");
    expect(agents).toBe(
      "# Agents\n\nRules.\n\nThis project builds its UI with `@tarassov-ch/swiss-function`. Read [SWISS-FUNCTION.md](SWISS-FUNCTION.md) before writing UI code.\n",
    );
    expect(claude.match(/@SWISS-FUNCTION\.md/g)).toHaveLength(1);
    expect(printed.join("")).toContain("already refers to SWISS-FUNCTION.md");
  });

  it("--link changes a CLAUDE.md that links to AGENTS.md once, as AGENTS.md", async () => {
    writeFileSync(join(host, "AGENTS.md"), "# Agents\n");
    symlinkSync("AGENTS.md", join(host, "CLAUDE.md"));
    await go(["guide", "--link"]);
    const agents = readFileSync(join(host, "AGENTS.md"), "utf8");
    expect(agents.match(/SWISS-FUNCTION\.md/g)).toHaveLength(2);
    expect(agents).not.toContain("@SWISS-FUNCTION.md");
  });

  it("says where to point an agent when there is nothing to link from", async () => {
    await go(["guide", "--link"]);
    expect(printed.join("")).toContain("No AGENTS.md or CLAUDE.md here");
  });

  it("--stdout prints the guide and writes nothing", async () => {
    expect(await go(["guide", "--stdout"])).toBe(0);
    expect(printed.join("")).toContain("# Using it");
    expect(() => readFileSync(join(host, "SWISS-FUNCTION.md"))).toThrow();
  });

  it("from a project without the package, points where it will be and says so", async () => {
    const bare = mkdtempSync(join(tmpdir(), "sf-bare-"));
    try {
      expect(await go(["guide"], bare)).toBe(0);
      const text = readFileSync(join(bare, "SWISS-FUNCTION.md"), "utf8");
      expect(text).toContain("](./node_modules/@tarassov-ch/swiss-function/dist/guide/API.md)");
      expect(printed.join("")).toContain("install the package here");
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("explains itself, and refuses what it does not know", async () => {
    expect(await go([])).toBe(0);
    expect(printed.join("")).toContain("Usage: npx swiss-function guide");
    expect(await go(["build"])).toBe(2);
    expect(await go(["guide", "--nope"])).toBe(2);
    expect(parseArgs(["guide", "--out"]).error).toBe("--out needs a file name");
  });
});
