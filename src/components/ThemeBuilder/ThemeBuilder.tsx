import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback, useMemo, useState } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { Field } from "../Field";
import { Input } from "../Input";
import { Switch } from "../Switch";
import styles from "./ThemeBuilder.module.css";
import {
  emptyOverrides,
  hasOverrides,
  THEME_GROUPS,
  THEME_TOKENS,
  type ThemeOverrides,
  type ThemeToken,
  themeToCss,
  themeToJson,
} from "./tokens";

export type { ThemeOverrides, ThemeToken } from "./tokens";
export { themeToCss, themeToJson } from "./tokens";

type Theme = "light" | "dark";

export interface ThemeBuilderProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Which theme's tokens the colour controls edit first. Default `"light"`. */
  defaultTheme?: Theme;
  /** Override the curated authorable token list. */
  tokens?: ThemeToken[];
  /** Fires whenever an override changes, with the full (changed-only) map. */
  onChange?: (overrides: ThemeOverrides) => void;
  /** Preview content rendered under the live theme. Defaults to a component
   *  sample gallery. */
  children?: ReactNode;
}

const HEX6 = /^#[0-9a-f]{6}$/i;

/** Live token editor + preview + export (issue #50). Tweak the curated `--sf-*`
 *  tokens and watch a component sample retheme instantly (overrides are applied
 *  as inline custom properties on the preview scope), then copy the result as a
 *  CSS theme or JSON. `tokens.css` stays the canonical source — this only makes
 *  overriding it ergonomic. */
export const ThemeBuilder = forwardRef<HTMLDivElement, ThemeBuilderProps>(function ThemeBuilder(
  { defaultTheme = "light", tokens = THEME_TOKENS, onChange, className, children, ...rest },
  ref,
) {
  const [overrides, setOverrides] = useState<ThemeOverrides>(emptyOverrides);
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [format, setFormat] = useState<"css" | "json">("css");
  const [copied, setCopied] = useState(false);

  const update = useCallback(
    (next: ThemeOverrides) => {
      setOverrides(next);
      onChange?.(next);
      setCopied(false);
    },
    [onChange],
  );

  const tokenValue = (token: ThemeToken): string => {
    if (!token.themed) return overrides.base[token.name] ?? token.light;
    return overrides[theme][token.name] ?? token[theme];
  };

  const setToken = (token: ThemeToken, value: string) => {
    const bucket: keyof ThemeOverrides = token.themed ? theme : "base";
    const dflt = token.themed ? token[theme] : token.light;
    const nextBucket = { ...overrides[bucket] };
    // Drop the key when it matches the default so it doesn't export as a no-op.
    if (value === dflt || value === "") {
      delete nextBucket[token.name];
    } else {
      nextBucket[token.name] = value;
    }
    update({ ...overrides, [bucket]: nextBucket });
  };

  const reset = () => update(emptyOverrides());

  // Inline custom properties for the preview scope: theme-agnostic + the
  // current theme's colour overrides. Un-overridden tokens fall through to
  // tokens.css via the cascade.
  const previewStyle = useMemo(
    () => ({ ...overrides.base, ...overrides[theme] }) as CSSProperties,
    [overrides, theme],
  );

  const output = format === "css" ? themeToCss(overrides) : themeToJson(overrides);
  const dirty = hasOverrides(overrides);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <div className={styles.layout}>
        {/* Controls */}
        <div className={styles.controls}>
          {/* biome-ignore lint/a11y/useSemanticElements: a segmented pair of toggle Buttons; a <fieldset>+<legend> would impose its own layout/box on the toolbar. */}
          <div className={styles.themeToggle} role="group" aria-label="Edit theme">
            <Button
              size="sm"
              variant={theme === "light" ? "primary" : "secondary"}
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
            >
              Light
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "primary" : "secondary"}
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
            >
              Dark
            </Button>
          </div>

          {THEME_GROUPS.map((group) => {
            const groupTokens = tokens.filter((tk) => tk.group === group);
            if (!groupTokens.length) return null;
            return (
              <fieldset key={group} className={styles.group}>
                <legend className={styles.legend}>{group}</legend>
                {groupTokens.map((tk) => {
                  const value = tokenValue(tk);
                  const agnostic = !tk.themed;
                  return (
                    <div key={tk.name} className={styles.row}>
                      <label className={styles.label} htmlFor={`tb-${tk.name}`}>
                        {tk.label}
                        {agnostic ? <span className={styles.agnostic}> (all themes)</span> : null}
                      </label>
                      <div className={styles.editor}>
                        {tk.kind === "color" ? (
                          <input
                            type="color"
                            className={styles.swatch}
                            aria-label={`${tk.label} colour`}
                            value={HEX6.test(value) ? value : "#000000"}
                            onChange={(e) => setToken(tk, e.target.value)}
                          />
                        ) : null}
                        <Input
                          id={`tb-${tk.name}`}
                          inputSize="sm"
                          value={value}
                          onChange={(e) => setToken(tk, e.target.value)}
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  );
                })}
              </fieldset>
            );
          })}
        </div>

        {/* Live preview */}
        <div className={styles.previewPane}>
          <div className={styles.previewLabel}>Preview · {theme}</div>
          <div className={styles.preview} data-theme={theme} style={previewStyle}>
            {children ?? <DefaultPreview />}
          </div>
        </div>

        {/* Export */}
        <div className={styles.export}>
          <div className={styles.exportBar}>
            {/* biome-ignore lint/a11y/useSemanticElements: a segmented pair of toggle Buttons; a <fieldset>+<legend> would impose its own layout/box on the toolbar. */}
            <div className={styles.formatToggle} role="group" aria-label="Export format">
              <Button
                size="sm"
                variant={format === "css" ? "primary" : "secondary"}
                onClick={() => setFormat("css")}
                aria-pressed={format === "css"}
              >
                CSS
              </Button>
              <Button
                size="sm"
                variant={format === "json" ? "primary" : "secondary"}
                onClick={() => setFormat("json")}
                aria-pressed={format === "json"}
              >
                JSON
              </Button>
            </div>
            <div className={styles.exportActions}>
              <Button size="sm" variant="secondary" onClick={reset} disabled={!dirty}>
                Reset
              </Button>
              <Button size="sm" onClick={copy} disabled={!dirty}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <section className={styles.output} aria-label={`Generated ${format}`}>
            <pre className={styles.pre}>{output}</pre>
          </section>
        </div>
      </div>
    </div>
  );
});

/** The default preview: a small gallery that exercises the edited tokens. */
function DefaultPreview() {
  return (
    <div className={styles.gallery}>
      <div className={styles.galleryRow}>
        <Button size="sm">Primary</Button>
        <Button size="sm" variant="secondary">
          Secondary
        </Button>
        <Button size="sm" variant="danger">
          Danger
        </Button>
      </div>
      <Field>
        <Field.Label>Email</Field.Label>
        <Input inputSize="sm" placeholder="you@example.com" />
      </Field>
      <div className={styles.galleryRow}>
        <Chip tone="primary" dot>
          Primary
        </Chip>
        <Chip tone="success" dot>
          Success
        </Chip>
        <Chip tone="warning" dot>
          Warning
        </Chip>
        <Chip tone="danger" dot>
          Danger
        </Chip>
      </div>
      <div className={styles.galleryRow}>
        <Switch defaultChecked />
        <span className={styles.galleryText}>Notifications</span>
      </div>
    </div>
  );
}
