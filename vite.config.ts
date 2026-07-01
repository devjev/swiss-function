import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { libInjectCss } from "vite-plugin-lib-inject-css";

const componentNames = [
  "BarChart",
  "Box",
  "BridgeChart",
  "Button",
  "ButtonGroup",
  "CandlestickChart",
  "Chat",
  "ChatDrawer",
  "Explorer",
  "Field",
  "Fullscreen",
  "Graph",
  "Grid",
  "Heatmap",
  "Input",
  "Kbd",
  "Map",
  "Markdown",
  "MenuBar",
  "NonIdealState",
  "Outliner",
  "Pane",
  "PointCloud",
  "Checkbox",
  "Switch",
  "Radio",
  "Dialog",
  "Drawer",
  "Popover",
  "Menu",
  "ContextMenu",
  "Prose",
  "Scatterplot",
  "Skeleton",
  "Spinner",
  "SplitPane",
  "StreamingTerminalText",
  "Surface",
  "DataTable",
  "Tabs",
  "TextEdit",
  "Timeline",
  "ToggleGroup",
  "Accordion",
  "Selector",
  "Reflow",
  "Picker",
  "Dropzone",
  "WindowArray",
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
    // Injects a side-effect `import "./<chunk>.css"` into every emitted JS
    // chunk that produced CSS. Without this, Vite's library mode emits the
    // CSS files but no JS imports them, so consumer bundlers (Vite/Rollup/
    // esbuild) prune them from the import graph and components render
    // unstyled. See bug report at v0.2.0.
    libInjectCss(),
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
        /^@dnd-kit\//,
        /^@tanstack\//,
        /^maplibre-gl/,
        /^react-markdown/,
        /^remark-/,
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
