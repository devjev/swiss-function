import react from "@vitejs/plugin-react";
import {defineConfig} from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // duckdb-wasm workers are same-origin module workers; no special config
  // needed beyond letting Vite serve the wasm assets it imports via ?url.
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
