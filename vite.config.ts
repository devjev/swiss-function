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
  "Chip",
  "Explorer",
  "Field",
  "FieldLayout",
  "Flows",
  "Form",
  "Fullscreen",
  "Graph",
  "Grid",
  "Heatmap",
  "Icon",
  "Input",
  "Kbd",
  "Map",
  "Markdown",
  "MenuBar",
  "Minimap",
  "NonIdealState",
  "Outliner",
  "Pane",
  "PointCloud",
  "Checkbox",
  "Switch",
  "Radio",
  "RadioTable",
  "DatePicker",
  "Dialog",
  "DigitInput",
  "DigitInputMicro",
  "Drawer",
  "Popover",
  "Menu",
  "ContextMenu",
  "Progress",
  "Prose",
  "Scatterplot",
  "Skeleton",
  "Spinner",
  "SplitPane",
  "Stack",
  "StreamingTerminalText",
  "Surface",
  "DataTable",
  "TableInput",
  "Tabs",
  "CodeEditor",
  "CodeEditorInline",
  "TextEdit",
  "TextEditInline",
  "ThemeBuilder",
  "Timeline",
  "ToggleGroup",
  "Selector",
  "Notebook",
  "Reflow",
  "Picker",
  "Dropzone",
  "VerticalForm",
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
        // Graph's engine — same treatment as maplibre-gl: in `dependencies`,
        // resolved by the consumer's bundler, never pre-bundled into dist.
        // Their transitive deps (graphology-utils, pandemonium, events) must
        // NOT be listed here: our own dist must never emit bare specifiers we
        // don't declare (pnpm strict mode) — they vanish from the bundle once
        // their importers are external.
        /^graphology/,
        /^sigma/,
        // CodeEditor's engine — same treatment as the above: in `dependencies`,
        // resolved by the consumer's bundler, never pre-bundled. Transitive deps
        // (style-mod, crelt, w3c-keyname, @lezer/common) vanish once their
        // @codemirror/@lezer importers are external, so they stay off this list.
        /^@codemirror\//,
        /^@lezer\//,
        /^@replit\/codemirror-vim/,
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
