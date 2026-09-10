---
bump: patch
---
Dev tooling: vitest's nested vite is pinned to 7 (`overrides`), so the lockfile carries no rolldown; a registry proxy without it (a corporate Nexus) installs the repository again. Dev-only, nothing in the published package changes.
