import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only *.test.{ts,tsx} are Vitest. *.spec.tsx are Playwright Component Tests.
    include: ["**/*.test.{ts,tsx}"],
  },
});
