import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const componentNames = [
  "Button",
  "Input",
  "Checkbox",
  "Switch",
  "Radio",
  "Dialog",
  "Popover",
  "Tooltip",
  "Menu",
  "Select",
  "Combobox",
  "Tabs",
  "Accordion",
];

const componentEntries = Object.fromEntries(
  componentNames.map((name) => [
    `components/${name}/index`,
    resolve(__dirname, `src/components/${name}/index.ts`),
  ]),
);

export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: "./tsconfig.build.json",
      entryRoot: "src",
      outDir: "dist",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.stories.tsx",
        "src/**/*.spec.tsx",
        "src/**/*.test.tsx",
        "src/global.d.ts",
      ],
      rollupTypes: false,
    }),
  ],
  css: {
    modules: {
      generateScopedName: "[name]_[local]__[hash:base64:5]",
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: true,
    minify: false,
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        /^react\//,
        /^react-dom\//,
        /^@base-ui\/react/,
      ],
      input: {
        index: resolve(__dirname, "src/index.ts"),
        ...componentEntries,
        "tokens/tokens": resolve(__dirname, "src/tokens/tokens.css"),
        "tokens/reset": resolve(__dirname, "src/tokens/reset.css"),
      },
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
