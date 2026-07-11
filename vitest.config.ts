import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only *.test.{ts,tsx} are Vitest. *.spec.tsx are Playwright Component Tests.
    include: ["**/*.test.{ts,tsx}"],
    // `.direnv` holds a nix flake snapshot of the repo (a second copy of src/);
    // without this, the include glob double-runs every test from there and the
    // copy's stale deps fail React module resolution.
    exclude: [...configDefaults.exclude, "**/.direnv/**", "examples/**"],
    // Third disjoint glob: *.bench.ts are micro-benchmarks (`npm run bench`),
    // ignored by both test runners above.
    benchmark: {
      include: ["**/*.bench.{ts,tsx}"],
      exclude: [...configDefaults.exclude, "**/.direnv/**", "examples/**"],
    },
  },
});
