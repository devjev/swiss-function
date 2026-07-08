#!/usr/bin/env node
// Token pipeline (issue #50). `src/tokens/tokens.css` stays the CANONICAL
// source; this parses it and emits the same tokens to other targets so they can
// be consumed outside CSS:
//
//   dist/tokens/tokens.json               { light, dark } declared values
//   dist/tokens/tokens.js + .d.ts         `values` + `vars` (var() accessors)
//   dist/tokens/tokens.style-dictionary.json   Style-Dictionary-format tree
//
// It is a lightweight, in-repo pipeline rather than the `style-dictionary`
// package: SD wants a JSON token source as canonical, which fights the
// anti-scope ("keeps tokens.css as the canonical source"). Instead we emit an
// SD-compatible tree *from* the CSS, so a consumer can still feed it into Style
// Dictionary downstream if they want more targets.
//
// Run standalone (`npm run tokens:build`) or as the tail of `npm run build`.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const srcCss = join(root, "src", "tokens", "tokens.css");
const outDir = join(root, "dist", "tokens");

/** Strip CSS comments so their contents never look like declarations. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Return the `{ … }` body (brace-matched) that follows the first selector
 *  matching `selectorRe`, or "" if not found. */
export function extractBlock(css, selectorRe) {
  const m = selectorRe.exec(css);
  if (!m) return "";
  let i = css.indexOf("{", m.index);
  if (i < 0) return "";
  let depth = 0;
  const start = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i);
  }
  return "";
}

/**
 * Parse `--name: value;` declarations from a block into an ordered object.
 * @returns {Record<string, string>}
 */
export function parseDeclarations(block) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim().replace(/\s+/g, " ");
  }
  return out;
}

/**
 * Parse tokens.css → { light, dark } (dark holds only its overrides).
 * @returns {{ light: Record<string, string>, dark: Record<string, string> }}
 */
export function parseTokensCss(css) {
  const clean = stripComments(css);
  const light = parseDeclarations(extractBlock(clean, /:root\s*,\s*\[data-theme="light"\]/));
  const dark = parseDeclarations(extractBlock(clean, /\[data-theme="dark"\]/));
  return { light, dark };
}

const camel = (name) =>
  name.replace(/^--sf-/, "").replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/**
 * `{ colorFg: "var(--sf-color-fg)", … }` — typed var() accessors for JS-land.
 * @returns {Record<string, string>}
 */
export function toVars(light) {
  /** @type {Record<string, string>} */
  const vars = {};
  for (const name of Object.keys(light)) vars[camel(name)] = `var(${name})`;
  return vars;
}

/**
 * Nest declared values into a Style-Dictionary tree: `--sf-color-bg-subtle`
 * → { color: { bg: { subtle: { value } } } }.
 * @returns {Record<string, any>}
 */
export function toStyleDictionary(values) {
  /** @type {Record<string, any>} */
  const tree = {};
  for (const [name, value] of Object.entries(values)) {
    const path = name.replace(/^--sf-/, "").split("-");
    let node = tree;
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      if (i === path.length - 1) {
        node[key] = { ...(node[key] ?? {}), value };
      } else {
        node[key] = node[key] ?? {};
        node = node[key];
      }
    }
  }
  return tree;
}

export function toJsModule(values, vars) {
  return (
    `// Generated from src/tokens/tokens.css by scripts/tokens/build.mjs — do not edit.\n` +
    `export const values = ${JSON.stringify(values, null, 2)};\n\n` +
    `export const vars = ${JSON.stringify(vars, null, 2)};\n`
  );
}

export function toDts() {
  return (
    `// Generated from src/tokens/tokens.css — do not edit.\n` +
    `export declare const values: { light: Record<string, string>; dark: Record<string, string> };\n` +
    `export declare const vars: Record<string, string>;\n`
  );
}

function main() {
  const css = readFileSync(srcCss, "utf8");
  const { light, dark } = parseTokensCss(css);
  const values = { light, dark };
  const vars = toVars(light);
  const sd = { light: toStyleDictionary(light), dark: toStyleDictionary(dark) };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "tokens.json"), `${JSON.stringify(values, null, 2)}\n`);
  writeFileSync(join(outDir, "tokens.style-dictionary.json"), `${JSON.stringify(sd, null, 2)}\n`);
  writeFileSync(join(outDir, "tokens.js"), toJsModule(values, vars));
  writeFileSync(join(outDir, "tokens.d.ts"), toDts());

  const n = Object.keys(light).length;
  console.log(
    `tokens: emitted ${n} tokens (+${Object.keys(dark).length} dark overrides) to dist/tokens/`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
