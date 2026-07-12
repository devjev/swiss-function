# Changesets

Intent-declared releases (issue #48). Every change that should appear in a
release lands with a **changeset** here: a small markdown file declaring the
version bump and a human-readable note.

## Add one

```bash
just changeset minor "Add the Form composition primitives"
# or
node scripts/changes/changes.mjs add patch "Fix DataTable header alignment"
```

That writes `.changes/<slug>.md`:

```md
---
bump: minor
---
Add the Form composition primitives (Form, FormField, FormError).
```

`bump` is `patch` | `minor` | `major`. The note is free markdown; it becomes a
bullet in the generated `CHANGELOG.md`.

## Release

`just release` (or `node scripts/changes/changes.mjs version`) aggregates every
pending changeset: the **highest** bump wins (a single `major` makes the release
major), the notes are prepended to `CHANGELOG.md` grouped by bump, the version is
bumped (`npm version`), and the consumed changeset files are deleted. Then the
version commit + tag are pushed and the existing `.gitea/workflows/publish.yml`
publishes to the Forgejo registry, now with the generated notes as the release
body instead of a hand-written blurb.

Check what's pending any time:

```bash
just changes-status        # or: node scripts/changes/changes.mjs status
```

Force a bump with no changesets (hotfix): `just release patch`.
