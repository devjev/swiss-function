/** A single authorable `--sf-*` token exposed by the ThemeBuilder. */
export interface ThemeToken {
  /** The custom property name, e.g. `--sf-color-fg`. */
  name: string;
  /** Human label shown in the control. */
  label: string;
  group: "Color" | "Dimension" | "Typography" | "Motion";
  /** `color` gets a swatch + hex field; `text` a plain field. */
  kind: "color" | "text";
  /** Themed tokens (colours) are edited per light/dark; the rest are a single
   *  theme-agnostic value exported to `:root`. */
  themed: boolean;
  /** Default value (light theme, or the single value when not themed). */
  light: string;
  /** Default value under the dark theme (equals `light` when not themed). */
  dark: string;
}

/** Per-bucket override maps. `base` = theme-agnostic tokens; `light` / `dark` =
 *  the themed (colour) tokens per theme. Only *changed* tokens appear. */
export interface ThemeOverrides {
  base: Record<string, string>;
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const emptyOverrides = (): ThemeOverrides => ({ base: {}, light: {}, dark: {} });

/** The curated authorable set — the tokens worth exposing in a live editor,
 *  drawn from `src/tokens/tokens.css`. Deliberately a subset: the ThemeBuilder
 *  makes *overriding* the palette ergonomic, it doesn't surface every internal
 *  variable (anti-scope of issue #50). */
export const THEME_TOKENS: ThemeToken[] = [
  // Color — themed (light / dark).
  c("--sf-color-bg", "Background", "#ffffff", "#0a0a0a"),
  c("--sf-color-bg-subtle", "Background (subtle)", "#f9fafb", "#171717"),
  c("--sf-color-fg", "Foreground", "#0a0a0a", "#fafafa"),
  c("--sf-color-fg-subtle", "Foreground (subtle)", "#4b5563", "#d4d4d4"),
  c("--sf-color-muted", "Muted", "#6b7280", "#9ca3af"),
  c("--sf-color-border", "Border", "#e5e7eb", "#262626"),
  c("--sf-color-primary", "Primary", "#2563eb", "#3b82f6"),
  c("--sf-color-primary-fg", "Primary text", "#ffffff", "#ffffff"),
  c("--sf-color-danger", "Danger", "#dc2626", "#ef4444"),
  c("--sf-color-success", "Success", "#16a34a", "#22c55e"),
  c("--sf-color-warning", "Warning", "#d97706", "#f59e0b"),
  c("--sf-color-focus-ring", "Focus ring", "#2563eb", "#60a5fa"),
  // Dimension — theme-agnostic.
  t("--sf-unit", "Base unit", "Dimension", "1.5rem"),
  t("--sf-radius-default", "Corner radius", "Dimension", "0.125rem"),
  // Typography — theme-agnostic.
  t("--sf-font-sans", "Sans family", "Typography", "ui-sans-serif, system-ui, sans-serif"),
  t("--sf-font-mono", "Mono family", "Typography", '"JetBrains Mono", ui-monospace, monospace'),
  t("--sf-font-size-base", "Base font size", "Typography", "1rem"),
  // Motion — theme-agnostic.
  t("--sf-duration-fast", "Duration (fast)", "Motion", "120ms"),
  t("--sf-duration-base", "Duration (base)", "Motion", "180ms"),
  t("--sf-duration-slow", "Duration (slow)", "Motion", "240ms"),
  t("--sf-ease-out", "Ease (out)", "Motion", "cubic-bezier(0.16, 1, 0.3, 1)"),
];

function c(name: string, label: string, light: string, dark: string): ThemeToken {
  return { name, label, group: "Color", kind: "color", themed: true, light, dark };
}
function t(name: string, label: string, group: ThemeToken["group"], value: string): ThemeToken {
  return { name, label, group, kind: "text", themed: false, light: value, dark: value };
}

/** Groups in display order. */
export const THEME_GROUPS: ThemeToken["group"][] = ["Color", "Dimension", "Typography", "Motion"];

// --- Export helpers (pure) --------------------------------------------------

const declarations = (map: Record<string, string>): string[] =>
  Object.entries(map).map(([k, v]) => `  ${k}: ${v};`);

/** Serialise overrides to a CSS theme: theme-agnostic + light tokens under
 *  `:root`, dark tokens under `[data-theme="dark"]`. Only changed tokens. */
export function themeToCss(o: ThemeOverrides): string {
  const rootLines = [...declarations(o.base), ...declarations(o.light)];
  const darkLines = declarations(o.dark);
  const blocks: string[] = [];
  if (rootLines.length) blocks.push(`:root {\n${rootLines.join("\n")}\n}`);
  if (darkLines.length) blocks.push(`[data-theme="dark"] {\n${darkLines.join("\n")}\n}`);
  return blocks.join("\n\n") || "/* No changes yet — tweak a token to build a theme. */";
}

/** Serialise overrides to JSON (only changed tokens), stripping empty buckets. */
export function themeToJson(o: ThemeOverrides): string {
  const out: Partial<ThemeOverrides> = {};
  for (const bucket of ["base", "light", "dark"] as const) {
    if (Object.keys(o[bucket]).length) out[bucket] = o[bucket];
  }
  return JSON.stringify(out, null, 2);
}

/** Whether any override is set. */
export function hasOverrides(o: ThemeOverrides): boolean {
  return Boolean(
    Object.keys(o.base).length || Object.keys(o.light).length || Object.keys(o.dark).length,
  );
}
