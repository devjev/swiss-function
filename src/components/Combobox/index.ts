// Internal only — Combobox is no longer part of the public API (use Picker for
// single-select or Selector for multi-select). It stays here as the styled
// Base UI compound that Picker and Selector are both built on. Deliberately not
// exported from `src/index.ts`, `vite.config.ts` `componentNames`, or the
// `package.json` `exports` map.
export { Combobox } from "./Combobox";
