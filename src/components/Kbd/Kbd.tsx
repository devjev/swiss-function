import type { HTMLAttributes } from "react";
import { Fragment, forwardRef } from "react";
import { cx } from "../../lib/cx";
import type { ControlSurface } from "../../lib/surface";
import { curveStyle, surfaceClass } from "../../lib/surface";
import styles from "./Kbd.module.css";

/** Best-effort macOS detection. Client-only libraries can read this
 *  synchronously; SSR consumers should pass the `mac` prop to avoid a mismatch. */
function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const ud = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = ud?.platform || navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Modifier tokens → glyph per platform. `mod` is the primary modifier and its
 *  aliases (cmd/command/meta) follow it — so a "cmd" shortcut shows Ctrl off-Mac,
 *  never a ⌘. */
const MOD_MAC: Record<string, string> = {
  mod: "⌘",
  cmd: "⌘",
  command: "⌘",
  meta: "⌘",
  super: "⌘",
  win: "⌘",
  ctrl: "⌃",
  control: "⌃",
  alt: "⌥",
  opt: "⌥",
  option: "⌥",
  shift: "⇧",
};
const MOD_OTHER: Record<string, string> = {
  mod: "Ctrl",
  cmd: "Ctrl",
  command: "Ctrl",
  meta: "Ctrl",
  super: "Super",
  win: "Win",
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  opt: "Alt",
  option: "Alt",
  shift: "Shift",
};

/** Named non-modifier keys → a compact, platform-independent label/glyph. */
const KEYS: Record<string, string> = {
  enter: "↵",
  return: "↵",
  escape: "Esc",
  esc: "Esc",
  tab: "⇥",
  space: "Space",
  backspace: "⌫",
  delete: "Del",
  del: "Del",
  arrowup: "↑",
  up: "↑",
  arrowdown: "↓",
  down: "↓",
  arrowleft: "←",
  left: "←",
  arrowright: "→",
  right: "→",
  pageup: "PgUp",
  pagedown: "PgDn",
  home: "Home",
  end: "End",
  plus: "+",
};

function renderKey(token: string, mac: boolean): string {
  const t = token.trim().toLowerCase();
  if (!t) return token;
  const mods = mac ? MOD_MAC : MOD_OTHER;
  if (t in mods) return mods[t] as string;
  if (t in KEYS) return KEYS[t] as string;
  // Single character → uppercase; longer unknown name → capitalized.
  return t.length === 1 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
}

/** `"keycap"` is the raised 3D key; `"outline"` is a flat ruled box per key,
 *  small enough to sit in a line of text (a label row, a menu item). */
export type KbdVariant = "keycap" | "outline";

/** Split a combo into its steps (a space separates the steps of a sequence,
 *  as in `"g u"`), and each step into the keys held together (`+`). */
function parseCombo(combo: string): string[][] {
  return combo
    .replace(/\s*\+\s*/g, "+")
    .split(/\s+/)
    .map((step) =>
      step
        .split("+")
        .map((k) => k.trim())
        .filter(Boolean),
    )
    .filter((step) => step.length > 0);
}

export interface KbdProps extends HTMLAttributes<HTMLSpanElement> {
  /** The combination. Keys held together are `+`-separated; a space separates
   *  the steps of a sequence (`"g u"`: G, then U). Modifiers: `mod` (⌘ on
   *  macOS, Ctrl elsewhere), `ctrl`, `alt`/`opt`, `shift`, `meta`. Keys:
   *  letters, `enter`, `esc`, `tab`, `space`, `arrowup`…, etc. e.g.
   *  `"mod+shift+k"`, `"alt+enter"`. */
  combo: string;
  /** `"keycap"` (default) the raised 3D key, or `"outline"` a flat ruled box
   *  per key that fits in a line of text. */
  variant?: KbdVariant;
  /** Force macOS rendering. Auto-detected from the browser otherwise; pass this
   *  for SSR/stories/tests to keep output deterministic. */
  mac?: boolean;
  /** The face of each keycap: `"dish"` (default) the scoop of a real key,
   *  `"dome"` a rounded cap, `"flat"` no ramp. */
  surface?: ControlSurface;
  /** Amplitude of the face ramp as a multiple of the system `--sf-curve`
   *  (1 = the token, 2 doubles it, 0 flattens the face). */
  curve?: number;
}

/** Renders a keyboard shortcut as OS-aware keycaps — ⌘⇧K on macOS,
 *  Ctrl + Shift + K elsewhere — for labels, menus, and tooltips. */
export const Kbd = forwardRef<HTMLSpanElement, KbdProps>(function Kbd(
  { combo, mac, variant = "keycap", surface = "dish", curve, style, className, ...rest },
  ref,
) {
  const isMac = mac ?? detectMac();
  const steps = parseCombo(combo);

  return (
    <span
      ref={ref}
      {...rest}
      style={curveStyle(curve, style)}
      className={cx(styles.root, className)}
      data-platform={isMac ? "mac" : "other"}
      data-variant={variant === "outline" ? "outline" : undefined}
    >
      {steps.map((keys, s) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: combo tokens have no stable identity and the list is static.
        <span key={`${keys.join("+")}-${s}`} className={styles.step}>
          {keys.map((k, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: combo tokens have no stable identity and the list is static.
            <Fragment key={`${k}-${i}`}>
              {/* Off-Mac, separate the word-modifiers with a "+"; macOS glyphs read as a unit. */}
              {i > 0 && !isMac ? <span className={styles.sep}>+</span> : null}
              <kbd className={styles.key}>
                {variant === "outline" ? null : (
                  <span className={cx(styles.face, surfaceClass[surface])} />
                )}
                <span className={styles.legend}>{renderKey(k, isMac)}</span>
              </kbd>
            </Fragment>
          ))}
        </span>
      ))}
    </span>
  );
});
