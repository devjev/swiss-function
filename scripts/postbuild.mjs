// Post-build CSS rewriter for the dist/ output.
//
// Vite library mode with CSS Modules ships three files per component:
//   Foo.js                — the React component
//   Foo.module.css        — the actual CSS rules (class names pre-hashed)
//   Foo.module.css.js     — a JS shim exporting the class-name map
//
// Two consumer-side problems with the default shape:
//
// 1. The side-effect CSS import lives in Foo.module.css.js (where
//    vite-plugin-lib-inject-css puts it), not in Foo.js. That works in
//    practice but leaves the import inside an intermediate file whose
//    semantics depend on the consumer's view of `.module.css.js`.
//
// 2. The CSS file ends in `.module.css`, which some bundlers (including
//    Vite-as-consumer with default settings) will try to re-process as a
//    CSS Module — duplicating scoping work that's already been done, and
//    in some configurations producing a class-name mismatch with the
//    pre-baked map in `.module.css.js`.
//
// This script rewrites dist/ so consumers see literal `.css` files
// imported as side effects from the component .js itself:
//
//   Foo.js
//     import "./Foo.css";                      // ← new (side effect)
//     import styles from "./Foo.module.css.js"; // ← existing (class map)
//   Foo.css                                     // ← renamed from Foo.module.css
//   Foo.module.css.js                           // ← side-effect import removed

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../dist");
const src = path.resolve(here, "../src");

// fonts.css is the optional JetBrains Mono webfont glue. It is deliberately
// NOT a vite input: it `@import`s bare `@fontsource/jetbrains-mono/*`
// specifiers that must reach the consumer's bundler untouched — routing it
// through vite would try to resolve/inline them at build time against a
// dependency that is only optional. So we copy it verbatim into dist.
await fs.mkdir(path.join(dist, "tokens"), { recursive: true });
await fs.copyFile(path.join(src, "tokens/fonts.css"), path.join(dist, "tokens/fonts.css"));

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = await walk(dist);

// Pass 1 — rename *.module.css → *.css.
let renamed = 0;
for (const file of files) {
  if (file.endsWith(".module.css")) {
    await fs.rename(file, file.replace(/\.module\.css$/, ".css"));
    renamed++;
  }
}

// Pass 2 — for each *.module.css.js: strip the side-effect import of
// "./X.module.css" that libInjectCss placed there, then patch the matching
// component .js (sibling, same basename minus .module.css.js) to add a
// side-effect import of "./X.css" before its existing imports.
let stripped = 0;
let injected = 0;
const skippedNoSibling = [];

for (const cssJsFile of files) {
  if (!cssJsFile.endsWith(".module.css.js")) continue;

  const original = await fs.readFile(cssJsFile, "utf-8");
  // libInjectCss emits a single line at the top, e.g. `import './Foo.module.css';`
  // — strip it (we no longer need it here; the component .js gets it instead).
  const withoutImport = original.replace(/^import\s+['"]\.\/[^'"]+\.module\.css['"];?\s*/m, "");
  if (withoutImport !== original) {
    await fs.writeFile(cssJsFile, withoutImport);
    stripped++;
  }

  const dir = path.dirname(cssJsFile);
  const baseName = path.basename(cssJsFile, ".module.css.js");
  const componentJs = path.join(dir, `${baseName}.js`);

  try {
    const componentContent = await fs.readFile(componentJs, "utf-8");
    // Only patch if the component actually consumes this module CSS map.
    if (!componentContent.includes(`./${baseName}.module.css.js`)) continue;
    // Skip if already patched (idempotent reruns).
    if (componentContent.startsWith(`import "./${baseName}.css";`)) continue;
    const patched = `import "./${baseName}.css";\n${componentContent}`;
    await fs.writeFile(componentJs, patched);
    injected++;
  } catch (err) {
    if (err.code === "ENOENT") {
      skippedNoSibling.push(path.relative(dist, cssJsFile));
      continue;
    }
    throw err;
  }
}

console.log(
  `postbuild: renamed ${renamed} CSS files, stripped ${stripped} module imports, injected ${injected} component imports, copied fonts.css`,
);
if (skippedNoSibling.length > 0) {
  console.log(`  (no sibling .js for: ${skippedNoSibling.join(", ")} — left untouched)`);
}
