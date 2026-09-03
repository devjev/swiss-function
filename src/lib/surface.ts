import type { CSSProperties } from "react";
import styles from "./surface.module.css";

/** The face of a control: flat, the scoop of a keycap (`dish`), a domed cap
 *  (`dome`), or a floor scooped into a recessed slot (`concave`). Components
 *  that carry a face (Button, Kbd, Switch, Slider, LaunchButton, ToggleGroup,
 *  DigitInput, Input, DigitInputMicro) take it as a `surface` prop with their
 *  own default; the classes paint the ramp over the element's `--sf-cap` base
 *  colour. Named `ControlSurface`: `Surface` is the 3D chart. */
export type ControlSurface = "flat" | "dish" | "dome" | "concave";

/** The inline style that carries a component's `curve` prop: `--sf-curve-scale`,
 *  the multiplier of the system amplitude `--sf-curve` (1 = the token, 2
 *  doubles it, 0 flattens the face). It inherits, so it goes on the component
 *  root and reaches the face inside. Leaves `style` untouched when no curve is
 *  set, so nothing is emitted by default. */
type StyleFn<S> = (state: S) => CSSProperties | undefined;

export function curveStyle(
  curve: number | undefined,
  style?: CSSProperties,
): CSSProperties | undefined;
export function curveStyle<S>(
  curve: number | undefined,
  style?: CSSProperties | StyleFn<S>,
): CSSProperties | StyleFn<S> | undefined;
export function curveStyle<S>(
  curve: number | undefined,
  style?: CSSProperties | StyleFn<S>,
): CSSProperties | StyleFn<S> | undefined {
  if (curve === undefined) return style;
  const scale = { "--sf-curve-scale": curve } as CSSProperties;
  // Base UI parts accept a style callback of their state; keep it a callback.
  if (typeof style === "function") return (state: S) => ({ ...style(state), ...scale });
  return { ...style, ...scale };
}

export const surfaceClass: Record<ControlSurface, string> = {
  flat: styles.flat ?? "",
  dish: styles.dish ?? "",
  dome: styles.dome ?? "",
  concave: styles.concave ?? "",
};
