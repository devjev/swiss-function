---
bump: minor
---
`npx swiss-function guide` writes a guide to using the library into the host project, for the coding agents that build its UI: the components and when to reach for each, the conventions and the anti-patterns, built from AGENTS.md without its contributor sections. It writes `SWISS-FUNCTION.md` (`--out` for another path), with links to the full prop reference and AESTHETICS.md, which now ship in `dist/guide/`. `--link` adds a reference to it from `AGENTS.md` and an `@` import from a `CLAUDE.md` of its own, once. It overwrites only a file it wrote itself (`--force` otherwise); `--stdout` prints it. Run it again after upgrading. Closes #113.
