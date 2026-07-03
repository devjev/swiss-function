/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: "src/**/*.stories.{js,jsx,ts,tsx}",
  port: 61000,
  appendToHead: '<meta name="color-scheme" content="light dark">',
  // Point Ladle at a stories-only Vite config. Without this Ladle auto-loads
  // the root vite.config.ts (the library build with vite-plugin-dts + lib
  // mode), whose dts plugin crashes the stories build. See vite.ladle.config.ts.
  viteConfig: "vite.ladle.config.ts",
};
