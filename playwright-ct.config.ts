import { defineConfig, devices } from "@playwright/experimental-ct-react";

export default defineConfig({
  testDir: "src",
  testMatch: "**/*.spec.tsx",
  snapshotDir: "./__snapshots__",
  timeout: 10_000,
  fullyParallel: true,
  use: {
    trace: "on-first-retry",
    ctPort: 3100,
    ctViteConfig: {
      css: {
        modules: {
          generateScopedName: "[name]_[local]__[hash:base64:5]",
        },
      },
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
