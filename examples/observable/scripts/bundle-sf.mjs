// Spike #52 helper, part two. Framework's node-import bundler writes only the
// entry chunk of each import; a package module using dynamic import() (our
// lib/effects/useDitheredFill.js lazily imports webglFill.js) produces a
// secondary chunk that is never written, and the build dies with ENOENT.
// This prebundles the components the testbed needs into one flat ESM file
// with dynamic imports inlined, which is the shape issue #55 will give the
// real /observable entry. Third-party deps stay external: Framework's node
// channel handles them fine.
//
// Run after scripts/patch-for-spike.mjs: node scripts/bundle-sf.mjs
import {rollup} from "rollup";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import virtual from "@rollup/plugin-virtual";

const entry = `
export {Button} from "@tarassov-ch/swiss-function/button";
export {Field} from "@tarassov-ch/swiss-function/field";
export {Input} from "@tarassov-ch/swiss-function/input";
export {DatePicker} from "@tarassov-ch/swiss-function/date-picker";
export {DataTable} from "@tarassov-ch/swiss-function/data-table";
`;

// Framework's _node shim for CommonJS react has named exports only (no
// default). Dependencies that default-import react (@dnd-kit/accessibility
// does) break at runtime. Route every `import ... from "react"` inside the
// bundle through a shim that also provides a default export; the shim itself
// uses only a namespace import, which the Framework shim supports. The real
// /observable entry (#55) needs the same interop.
const reactShim = `
import * as R from "sf-react-external";
export * from "sf-react-external";
export default R;
`;

const bundle = await rollup({
  input: "sf",
  onwarn(warning, warn) {
    if (warning.code === "MODULE_LEVEL_DIRECTIVE") return; // "use client" noise
    warn(warning);
  },
  plugins: [
    virtual({sf: entry, "sf-react-shim": reactShim}),
    {
      name: "react-default-interop",
      resolveId(id) {
        // Bare "react" must NOT be in the external() list: rollup consults
        // external() before plugin resolution, which would bypass this hook.
        if (id === "react") return "\0virtual:sf-react-shim";
        if (id === "sf-react-external") return {id: "react", external: true};
        return null;
      },
    },
    nodeResolve({browser: true}),
    commonjs(),
    {
      // Framework's node pipeline defines NODE_ENV via esbuild; do the same
      // here or CJS dev/prod switches hit `process` at runtime in the browser.
      name: "define-node-env",
      transform(code) {
        return code.includes("process.env.NODE_ENV")
          ? {code: code.replaceAll("process.env.NODE_ENV", '"production"'), map: null}
          : null;
      },
    },
  ],
  // Only react and react-dom stay external (they must be the single shared
  // instance). Everything else is bundled in: third-party deps left external
  // go through Framework's node channel, whose CommonJS react shim has no
  // default export, and any dep that default-imports react then dies at
  // runtime (@dnd-kit/accessibility does exactly that).
  external: (id) => id === "react-dom" || id.startsWith("react/") || id.startsWith("react-dom/"),
});
await bundle.write({
  file: new URL("../src/lib/sf-bundle.js", import.meta.url).pathname,
  format: "esm",
  inlineDynamicImports: true,
});
await bundle.close();
console.log("wrote src/lib/sf-bundle.js");
