import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Ladle-only Vite config. The root `vite.config.ts` is the *library* build
// (vite-plugin-dts + lib mode + preserveModules); Ladle would otherwise
// auto-load it and crash — dts's buildStart hook throws
// "Cannot read properties of undefined (reading 'compilerOptions')" because
// the stories build has no library entry/tsconfig context. This config keeps
// only what the stories app needs: React + the same CSS Modules scoped-name
// scheme used by the library so class names render identically in dev/build.
export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      generateScopedName: "[name]_[local]__[hash:base64:5]",
    },
  },
});
