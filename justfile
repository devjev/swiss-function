# Swiss-Function — task runner. `just` lists recipes.

set shell := ["bash", "-cu"]

# Default: list recipes
default:
    @just --list

# Run Ladle dev server (component stories)
dev:
    npm run dev

# Build library (types + bundle + postbuild)
build:
    npm run build

# Build static Ladle stories site
build-stories:
    npm run build:stories

# Run unit tests once
test:
    npm run test

# Run unit tests in watch mode
test-watch:
    npm run test:watch

# Run Playwright component tests
test-ct:
    npm run test:ct

# Run micro-benchmarks (vitest bench, *.bench.ts)
bench:
    npm run bench

# Run interaction-latency probes against a running Ladle (just dev)
perf:
    npm run perf

# Rewrite the perf baseline from this run
perf-update:
    npm run perf:update

# Measure per-entry bundle sizes of dist (build first)
size:
    npm run size

# Rewrite the size baseline from this dist
size-update:
    npm run size:update

# Visual regression: pixel-diff every story in both themes vs baseline
# (needs Ladle — `just dev` — or it will start one). Local gate.
vrt:
    npm run vrt

# Seed / rewrite the visual-regression baselines (baseline machine only)
vrt-update:
    npm run vrt:update

# Refresh vrt/stories.json from the running Ladle's story list
vrt-list:
    npm run vrt:list

# Biome lint
lint:
    npm run lint

# Biome format (writes)
format:
    npm run format

# Biome check (lint + format)
check:
    npm run check

# TypeScript typecheck (no emit)
typecheck:
    npm run typecheck

# Pre-publish gate (check + typecheck + build)
prepublish:
    npm run prepublishOnly

# Pack the npm tarball and attach it to the Gitea release of the current
# package.json version — releases ship the package, not just source archives.
# Run from the tag's source, after `tea releases create --tag vX.Y.Z ...`.
release-package:
    #!/usr/bin/env bash
    set -euo pipefail
    version=$(node -p "require('./package.json').version")
    npm run prepublishOnly
    tarball=$(npm pack --pack-destination /tmp | tail -1)
    tea releases assets create "v${version}" "/tmp/${tarball}"
    tea releases assets list "v${version}"

# Install dependencies
install:
    npm install

# Clean build artifacts
clean:
    rm -rf dist .ladle/build test-results playwright-report coverage perf/results

# Declare a changeset for the current change (issue #48): intent + note.
# e.g. `just changeset minor "Add the Form primitives"`. Aggregated at release.
changeset bump note:
    node scripts/changes/changes.mjs add {{bump}} "{{note}}"

# Show pending changesets and the version bump they'd produce
changes-status:
    node scripts/changes/changes.mjs status

# Cut a release: aggregate the pending changesets into a single bump, generate
# the CHANGELOG section, bump the version, then commit + tag + push — CI
# (.gitea/workflows/publish.yml) publishes the package and creates the Forgejo
# release with the tarball attached and the generated notes as its body. Pass an
# explicit bump (patch/minor/major) to force one with no changesets (hotfix).
# Tag only after merging to main.
release bump="":
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -n "{{bump}}" ]; then
        node scripts/changes/changes.mjs version --bump "{{bump}}"
    else
        node scripts/changes/changes.mjs version
    fi
    version=$(node -p "require('./package.json').version")
    git add -A
    git commit -m "${version}"
    git tag "v${version}"
    git push --follow-tags
