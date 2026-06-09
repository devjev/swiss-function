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

# Install dependencies
install:
    npm install

# Clean build artifacts
clean:
    rm -rf dist .ladle/build test-results playwright-report coverage
