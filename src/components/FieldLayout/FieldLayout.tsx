/** FieldLayout — justified form rows of rigid / flexible / filler fields
 *  (issue #33). Lifted from an app-side system that took several iterations.
 *
 *  The model: a form is Sections; a Section is a `flex-wrap` container whose
 *  wrapped lines ARE the rows. Every element is one of three kinds — rigid
 *  (holds a whole-unit width), flexible (flexes between a unit min and max),
 *  filler (absorbs slack) — and each line justifies (fills left padding to
 *  right padding) because the flexible fields and fillers in it grow. Because
 *  it is flex-wrap (not grid auto-flow), fields keep strict source order and
 *  never migrate between lines; narrowing the container simply carries fewer
 *  fields per line — gradual collapse with no breakpoints. Layout is pure
 *  CSS; no ResizeObserver drives it.
 */

import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode, RefObject } from "react";
import { cloneElement, Fragment, forwardRef, isValidElement, useId, useRef } from "react";
import { cx } from "../../lib/cx";
import { type EffectName, useDitheredFill } from "../../lib/effects";
import { mergeRefs } from "../../lib/mergeRefs";
import { useResizeSnap } from "../../lib/useResizeSnap";
import styles from "./FieldLayout.module.css";

// --- Root -------------------------------------------------------------------

export interface FieldLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** Padding around the sections, in `--sf-unit` multiples. Rows justify from
   *  the left padding to the right padding. Default `1`. */
  padding?: number;
}

const Root = forwardRef<HTMLDivElement, FieldLayoutProps>(function FieldLayout(
  { padding = 1, className, style, ...rest },
  ref,
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.root, className)}
      style={{ "--fl-pad": String(padding), ...style } as CSSProperties}
    />
  );
});

// --- Section ----------------------------------------------------------------

export type FieldLayoutSectionProps = HTMLAttributes<HTMLDivElement>;

const Section = forwardRef<HTMLDivElement, FieldLayoutSectionProps>(function FieldLayoutSection(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.section, className)} />;
});

// --- Field ------------------------------------------------------------------

export type FieldKind = "flexible" | "rigid" | "prose" | "filler";

interface KindDefaults {
  grow: number;
  basis: number;
  min: number | null;
  max: number | null;
}

/** Per-kind flex defaults (whole units), overridable per field. The 36u
 *  flexible ceiling is deliberately above the widest row a field *wraps* into
 *  alone (its basis 14u + gap 1u + the next field's min 10u = 25u), so a field
 *  that naturally ends up alone on a narrow line still grows to justify it. A
 *  lone field on a genuinely wide container caps at 36u and leaves trailing
 *  space by design — compose that case with an explicit Filler. */
const KIND: Record<FieldKind, KindDefaults> = {
  flexible: { grow: 1, basis: 14, min: 10, max: 36 },
  prose: { grow: 3, basis: 20, min: 10, max: null },
  rigid: { grow: 0, basis: 8, min: null, max: null },
  filler: { grow: 1, basis: 0, min: 10, max: null },
};

export interface FieldLayoutFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Field kind. Default `"flexible"`. */
  kind?: FieldKind;
  /** Label above the control. Associated with the control via `aria-labelledby`
   *  (so composite controls like DatePicker take the label as their accessible
   *  name instead of a placeholder). */
  label?: ReactNode;
  /** Hint text beside the control (below it when narrow). Renders as the row's
   *  inner filler — it justifies a rigid control's line and wraps beneath last. */
  hint?: ReactNode;
  /** Fixed width (rigid) in units. Default `8`. */
  width?: number;
  /** Flex-basis (preferred width) in units. Overrides the kind default. */
  preferred?: number;
  /** Min inline size in units. Overrides the kind default. */
  min?: number;
  /** Max inline size in units, or `false` for none. Overrides the kind default. */
  max?: number | false;
  /** Flex-grow weight. Overrides the kind default. */
  grow?: number;
  /** The control (an Input, DatePicker, TextEdit, …). */
  children?: ReactNode;
}

const u = (n: number) => `calc(${n} * var(--sf-unit))`;

const Field = forwardRef<HTMLDivElement, FieldLayoutFieldProps>(function FieldLayoutField(
  {
    kind = "flexible",
    label,
    hint,
    width,
    preferred,
    min,
    max,
    grow,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const labelId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  // Whole-unit height + snap-after-drag for a resizable control (TextEdit).
  useResizeSnap(bodyRef);

  const def = KIND[kind];
  const isRigid = kind === "rigid";
  const controlWidth = width ?? def.basis;

  // A rigid field holds its control width but must still be able to grow when
  // it carries a hint, so its row can justify (the hint is the grower).
  const effectiveGrow = grow ?? (isRigid ? (hint ? 1 : 0) : def.grow);
  const basis = isRigid ? controlWidth : (preferred ?? def.basis);
  const minU = isRigid ? null : (min ?? def.min);
  const maxU = max === false ? null : (max ?? def.max);

  const fieldVars = {
    "--fl-grow": String(effectiveGrow),
    "--fl-basis": u(basis),
    "--fl-min": minU == null ? "0" : u(minU),
    "--fl-max": maxU == null ? "none" : u(maxU),
  } as CSSProperties;

  // Wire the label to the control (composite controls that spread aria to
  // their focusable element take it; DatePicker forwards aria-labelledby). A
  // Fragment/array child can't carry the prop — cloneElement silently drops
  // it on a Fragment — so warn instead of breaking the accessible name quietly.
  let control = children;
  if (label && isValidElement(children) && children.type !== Fragment) {
    const child = children as ReactElement<{ "aria-labelledby"?: string }>;
    const existing = child.props["aria-labelledby"];
    // Prepend our labelId so FieldLayout's label is the primary accessible name.
    control = cloneElement(child, {
      "aria-labelledby": existing ? `${labelId} ${existing}` : labelId,
    });
  } else if (label && children != null && process.env.NODE_ENV !== "production") {
    console.warn(
      "FieldLayout.Field: `label` needs a single control element to associate " +
        "with (via aria-labelledby). Wrap multiple nodes in one element, or give " +
        "the control its own accessible name.",
    );
  }

  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.field, className)}
      data-kind={kind}
      style={{ ...fieldVars, ...style }}
    >
      {label ? (
        <span id={labelId} className={styles.label}>
          {label}
        </span>
      ) : null}
      <div ref={bodyRef} className={styles.body}>
        <div
          className={styles.control}
          // A rigid control holds its width and never shrinks under the hint's
          // pressure — the hint wraps beneath it instead.
          style={isRigid ? { flex: "0 0 auto", inlineSize: u(controlWidth) } : undefined}
        >
          {control}
        </div>
        {hint ? <div className={styles.hint}>{hint}</div> : null}
      </div>
    </div>
  );
});

// --- Filler -----------------------------------------------------------------

export interface FieldLayoutFillerProps extends HTMLAttributes<HTMLDivElement> {
  /** Show a visible console-style dither instead of blank space — a short
   *  hint justifies its row structurally, but sometimes the emptiness after
   *  it should read as marked. `true` uses a gentle default effect; a string
   *  picks a specific one. Reduced motion draws a single static frame. */
  dither?: boolean | EffectName;
  /** Min inline size in units before it wraps away. Default `10`. */
  min?: number;
}

const Filler = forwardRef<HTMLDivElement, FieldLayoutFillerProps>(function FieldLayoutFiller(
  { dither = false, min = 10, className, style, children, ...rest },
  ref,
) {
  // "noise" is evenly covered — reads as a marked placeholder across the strip
  // rather than a centered motif that leaves the ends blank.
  const effect: EffectName = typeof dither === "string" ? dither : "noise";
  const { rootRef, canvasRef } = useDitheredFill({ effect, density: 0.5, opacity: 0.6 });
  const setRefs = mergeRefs<HTMLDivElement>(ref, rootRef as RefObject<HTMLDivElement>);

  return (
    <div
      {...rest}
      ref={setRefs}
      className={cx(styles.filler, className)}
      style={{ "--fl-min": u(min), ...style } as CSSProperties}
    >
      {dither ? (
        // biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative fill canvas, no focusable content (Skeleton/NonIdealState pattern)
        <canvas ref={canvasRef} className={styles.ditherCanvas} aria-hidden="true" />
      ) : null}
      {children}
    </div>
  );
});

export const FieldLayout = Object.assign(Root, { Section, Field, Filler });
