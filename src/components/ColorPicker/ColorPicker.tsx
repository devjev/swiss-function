import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import {
  alphaGradient,
  type ColorFormat,
  channelGradient,
  channelsToSrgb,
  clampToSrgb,
  clipSrgb,
  convert,
  hueIndex,
  type ParsedColor,
  parse,
  SPACE_IDS,
  SPACES,
  type SpaceId,
  srgbInGamut,
  srgbToHex,
  toCss,
} from "../../lib/color";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { DigitInputMicro } from "../DigitInputMicro";
import { ChevronDown, createIcon } from "../Icon";
import { Input } from "../Input";
import { Menu } from "../Menu";
import { Slider } from "../Slider";
import styles from "./ColorPicker.module.css";
import { ColorSwatch } from "./ColorSwatch";

const Eyedropper = createIcon(
  "Eyedropper",
  <>
    <path d="M13.4 2.6a1.5 1.5 0 0 0-2.1 0l-1.2 1.2 2.1 2.1 1.2-1.2a1.5 1.5 0 0 0 0-2.1Z" />
    <path d="m11.2 4.8-6 6V13h2.2l6-6" />
  </>,
);

/** The structured colour handed to `onChange` alongside the CSS string. */
export interface ColorValue {
  space: SpaceId;
  channels: number[];
  alpha: number;
  /** `#rrggbb` or `#rrggbbaa` (gamut-clipped). */
  hex: string;
  /** sRGB 0–255 (gamut-clipped). */
  rgb: [number, number, number];
  /** Whether the colour is inside the sRGB gamut. */
  inGamut: boolean;
}

export type ColorPickerSize = "sm" | "md" | "lg";

export interface ColorPickerProps
  extends Omit<ComponentPropsWithoutRef<"div">, "onChange" | "defaultValue" | "color"> {
  /** Controlled colour as a CSS string. */
  value?: string;
  /** Uncontrolled initial colour. Default `"#3b82f6"`. */
  defaultValue?: string;
  /** Fired live as the colour changes; gives the CSS string + parsed colour. */
  onChange?: (value: string, color: ColorValue) => void;
  /** Fired on commit (slider release / numeric or hex entry / swatch / clamp). */
  onChangeComplete?: (value: string, color: ColorValue) => void;
  /** Output string format. `"auto"` = `#rrggbb[aa]` in sRGB else `oklch()`. */
  format?: ColorFormat;
  /** Initial editing space. Default `"oklch"`. */
  defaultSpace?: SpaceId;
  /** Fired when the editing space changes. */
  onSpaceChange?: (space: SpaceId) => void;
  /** Which spaces to offer. Default all seven. */
  spaces?: SpaceId[];
  /** Show the alpha channel. Default `true`. */
  alpha?: boolean;
  /** Show the screen eyedropper if the browser supports it. Default `true`. */
  eyedropper?: boolean;
  /** Preset swatches shown below the channels. */
  swatches?: string[];
  /** Show the out-of-sRGB-gamut chip + clamp action. Default `true`. */
  gamutWarning?: boolean;
  /** Control size. Default `"md"`. */
  size?: ColorPickerSize;
  disabled?: boolean;
}

const FLAT = "inset 0 0 0 1px var(--sf-color-border)";

const roundTo = (n: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

interface State {
  space: SpaceId;
  channels: number[];
  alpha: number;
}

const initState = (css: string, space: SpaceId): State => {
  const p = parse(css) ?? { space: "rgb" as SpaceId, channels: [0, 0, 0], alpha: 1 };
  return { space, channels: convert(p.space, space, p.channels), alpha: p.alpha };
};

const hueOf = (space: SpaceId, channels: number[]): number | undefined => {
  const i = hueIndex(space);
  return i >= 0 ? channels[i] : undefined;
};

const sizeClass: Record<ColorPickerSize, string | undefined> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

/**
 * A channel-slider colour picker across OKLCH/OKLab/RGB/HSL/HSV/LCH/Lab plus a
 * hex field, with live gradient tracks, an alpha channel, an optional screen
 * eyedropper, and sRGB-gamut handling. Reads as an instrument panel. The value is
 * a CSS colour string; `onChange` also hands back the parsed {@link ColorValue}.
 * Drop it inline, or as the panel inside a `Popover` triggered by a `ColorSwatch`.
 */
export const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(function ColorPicker(
  {
    value,
    defaultValue,
    onChange,
    onChangeComplete,
    format = "auto",
    defaultSpace = "oklch",
    onSpaceChange,
    spaces,
    alpha: showAlpha = true,
    eyedropper = true,
    swatches,
    gamutWarning = true,
    size = "md",
    disabled,
    className,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  const [state, setState] = useState<State>(() =>
    initState(value ?? defaultValue ?? "#3b82f6", defaultSpace),
  );
  const [hexBuf, setHexBuf] = useState<string | null>(null);
  const [edSupported, setEdSupported] = useState(false);
  const lastEmit = useRef<string | null>(null);

  useEffect(() => {
    setEdSupported(typeof window !== "undefined" && "EyeDropper" in window);
  }, []);

  // Sync from a controlled `value` (ignoring our own emissions).
  useEffect(() => {
    if (value == null || value === lastEmit.current) return;
    const p = parse(value);
    if (!p) return;
    setState((s) => ({
      space: s.space,
      channels: convert(p.space, s.space, p.channels, hueOf(s.space, s.channels)),
      alpha: p.alpha,
    }));
  }, [value]);

  const { space, channels, alpha } = state;
  const availableSpaces = spaces ?? SPACE_IDS;
  const srgb = channelsToSrgb(space, channels);
  const display = clipSrgb(srgb);
  const opaqueHex = srgbToHex(display);
  const displayHex = srgbToHex(display, alpha);
  const inGamut = srgbInGamut(srgb);

  const colorValue = (n: State): ColorValue => {
    const d = clipSrgb(channelsToSrgb(n.space, n.channels));
    return {
      space: n.space,
      channels: n.channels.slice(),
      alpha: n.alpha,
      hex: srgbToHex(d, n.alpha),
      rgb: [Math.round(d[0] * 255), Math.round(d[1] * 255), Math.round(d[2] * 255)],
      inGamut: srgbInGamut(channelsToSrgb(n.space, n.channels)),
    };
  };

  const apply = (next: State, complete: boolean) => {
    setState(next);
    const css = toCss(next.space, next.channels, next.alpha, format);
    lastEmit.current = css;
    const cv = colorValue(next);
    onChange?.(css, cv);
    if (complete) onChangeComplete?.(css, cv);
  };

  const setChannel = (i: number, v: number, complete: boolean) => {
    const next = channels.slice();
    next[i] = v;
    apply({ space, channels: next, alpha }, complete);
  };
  const setAlpha = (a: number, complete: boolean) => {
    apply({ space, channels, alpha: Math.max(0, Math.min(1, a)) }, complete);
  };
  const reproject = (p: ParsedColor): State => ({
    space,
    channels: convert(p.space, space, p.channels, hueOf(space, channels)),
    alpha: p.alpha,
  });

  const switchSpace = (id: SpaceId) => {
    onSpaceChange?.(id);
    setState((s) => ({
      space: id,
      channels: convert(s.space, id, s.channels, hueOf(s.space, s.channels)),
      alpha: s.alpha,
    }));
  };

  const commitHex = (v: string) => {
    setHexBuf(v);
    const p = parse(v);
    if (p) apply(reproject(p), true);
  };

  const pickScreen = async () => {
    const ED = (
      window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
    ).EyeDropper;
    if (!ED) return;
    try {
      const { sRGBHex } = await new ED().open();
      const p = parse(sRGBHex);
      if (p) apply(reproject(p), true);
    } catch {
      // user cancelled — nothing to do
    }
  };

  const hexShown = hexBuf ?? displayHex;

  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.root, sizeClass[size], className)}
      data-disabled={disabled || undefined}
    >
      <div className={styles.header}>
        <Menu.Root>
          <Menu.Trigger className={styles.spaceBtn} disabled={disabled}>
            {SPACES[space].label}
            <ChevronDown size={0.75} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="start" sideOffset={4}>
              <Menu.Popup>
                {availableSpaces.map((id) => (
                  <Menu.Item key={id} onClick={() => switchSpace(id)}>
                    {SPACES[id].label}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <ColorSwatch
          color={displayHex}
          size="md"
          className={styles.preview}
          aria-label={`Current colour ${displayHex}`}
        />
      </div>

      {SPACES[space].channels.map((def, i) => {
        const val = channels[i] ?? def.min;
        const labelId = `${baseId}-${def.key}`;
        return (
          <div key={def.key} className={styles.channel}>
            <span id={labelId} className={styles.chLabel}>
              {def.label}
            </span>
            <Slider
              className={styles.chSlider}
              aria-labelledby={labelId}
              fill="none"
              valueLabel="off"
              size={size}
              min={def.min}
              max={def.max}
              step={def.step}
              value={val}
              disabled={disabled}
              onValueChange={(v) => setChannel(i, v as number, false)}
              onValueCommitted={(v) => setChannel(i, v as number, true)}
              style={
                {
                  "--sf-slider-track-bg": channelGradient(space, channels, i),
                  "--sf-slider-track-shadow": FLAT,
                } as CSSProperties
              }
            />
            <DigitInputMicro
              className={styles.chNum}
              size={size}
              slots={3}
              align="end"
              aria-labelledby={labelId}
              value={roundTo(val, def.decimals)}
              min={def.min}
              max={def.max}
              decimals={def.decimals}
              fixedDecimals={def.decimals > 0}
              unit={def.unit}
              disabled={disabled}
              onValueChange={(v) => v != null && setChannel(i, v, true)}
            />
          </div>
        );
      })}

      {showAlpha && (
        <div className={styles.channel}>
          <span id={`${baseId}-a`} className={styles.chLabel}>
            A
          </span>
          <Slider
            className={styles.chSlider}
            aria-labelledby={`${baseId}-a`}
            fill="none"
            valueLabel="off"
            size={size}
            min={0}
            max={100}
            step={1}
            value={Math.round(alpha * 100)}
            disabled={disabled}
            onValueChange={(v) => setAlpha((v as number) / 100, false)}
            onValueCommitted={(v) => setAlpha((v as number) / 100, true)}
            style={
              {
                "--sf-slider-track-bg": `${alphaGradient(opaqueHex)}, var(--cp-checker)`,
                "--sf-slider-track-shadow": FLAT,
              } as CSSProperties
            }
          />
          <DigitInputMicro
            className={styles.chNum}
            size={size}
            slots={3}
            align="end"
            aria-labelledby={`${baseId}-a`}
            value={Math.round(alpha * 100)}
            min={0}
            max={100}
            decimals={0}
            unit="%"
            disabled={disabled}
            onValueChange={(v) => v != null && setAlpha(v / 100, true)}
          />
        </div>
      )}

      <div className={styles.footer}>
        <Input
          className={styles.hex}
          inputSize={size}
          value={hexShown}
          spellCheck={false}
          aria-label="Hex"
          disabled={disabled}
          onFocus={() => setHexBuf(displayHex)}
          onBlur={() => setHexBuf(null)}
          onChange={(e) => commitHex(e.target.value)}
        />
        {eyedropper && edSupported && (
          <Button
            variant="secondary"
            size="sm"
            onClick={pickScreen}
            disabled={disabled}
            aria-label="Pick colour from screen"
          >
            <Eyedropper />
          </Button>
        )}
      </div>

      {gamutWarning && !inGamut && (
        <div className={styles.gamut}>
          <Chip tone="warning" size="sm">
            OUT OF GAMUT (sRGB)
          </Chip>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => apply({ space, channels: clampToSrgb(space, channels), alpha }, true)}
          >
            Clamp
          </Button>
        </div>
      )}

      {swatches && swatches.length > 0 && (
        <div className={styles.swatches}>
          {swatches.map((sw) => (
            <ColorSwatch
              key={sw}
              color={sw}
              size="sm"
              disabled={disabled}
              onClick={() => {
                const p = parse(sw);
                if (p) apply(reproject(p), true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
