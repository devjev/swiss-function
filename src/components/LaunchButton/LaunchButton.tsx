import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type {
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import type { BoxElevation } from "../Box";
import { Button } from "../Button";
import { Switch } from "../Switch";
import styles from "./LaunchButton.module.css";

export type LaunchButtonMode = "button" | "switch";
export type LaunchButtonOrientation = "horizontal" | "vertical";
export type LaunchButtonSize = "sm" | "md" | "lg";
export type LaunchButtonTone = "danger" | "primary";
export type LaunchButtonOpenChangeReason =
  | "toggle" // guard clicked / Enter or Space on the guard
  | "escape" // Escape while open
  | "focus" // focus left the component
  | "pointer" // pointer left with no focus inside
  | "fired"; // auto-shut after the action fired (button mode)

/** How long the fired press-flash is held before the guard snaps shut. Long
 *  enough to register after the fast press transition, short of laggy. */
const FIRE_HOLD_MS = 500;

export interface LaunchButtonProps extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
  /** `"button"`: open guard → press → fires once → guard snaps shut.
   *  `"switch"`: an on/off armed state under the guard. Default `"button"`. */
  mode?: LaunchButtonMode;
  /** Button mode: fires once per open/press cycle. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Switch mode: the armed state (controlled). */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Guard cover state (controlled / uncontrolled). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: LaunchButtonOpenChangeReason) => void;
  /** Legend engraved on the guard lid (e.g. "ARM"). Also names the guard for
   *  assistive tech ("<guardLabel> guard"). Omit → stripes only; the guard is
   *  named "Guard for <children>" when children is a string, else "Guard". */
  guardLabel?: string;
  /** The action label on the revealed control. */
  children: ReactNode;
  /** `"horizontal"` (default): one dense row. `"vertical"`: a narrow panel
   *  column — in switch mode the control is a bat-handle toggle lever between
   *  engraved ON/OFF marks, with `children` as the panel legend below. */
  orientation?: LaunchButtonOrientation;
  /** Matches Button sizes; the well and lid track it. Default `"md"`. */
  size?: LaunchButtonSize;
  /** `"danger"` (default): hazard-striped lid, danger action. `"primary"`:
   *  plain lid, for deliberate but non-destructive actions. */
  tone?: LaunchButtonTone;
  disabled?: boolean;
  /** Resting depth of the lid — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
}

export const LaunchButton = forwardRef<HTMLDivElement, LaunchButtonProps>(function LaunchButton(
  {
    mode = "button",
    onClick,
    checked: checkedProp,
    defaultChecked = false,
    onCheckedChange,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    guardLabel,
    children,
    orientation = "horizontal",
    size = "md",
    tone = "danger",
    disabled,
    elevation,
    className,
    onKeyDown,
    onBlur,
    onPointerLeave,
    ...rest
  },
  ref,
) {
  const wellId = useId();
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const guardRef = useRef<HTMLButtonElement>(null);
  const innerRef = useRef<HTMLButtonElement>(null);
  const fireTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Keyboard-opening should land focus on the revealed control, but the well
  // is inert until the open render commits — flag it and focus in the effect.
  const focusInnerOnOpenRef = useRef(false);

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = openProp ?? internalOpen;
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const checked = checkedProp ?? internalChecked;
  const [fired, setFired] = useState(false);
  const armed = mode === "switch" && checked;

  const setOpen = (next: boolean, reason: LaunchButtonOpenChangeReason) => {
    if (openProp === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next, reason);
  };

  const setChecked = (next: boolean) => {
    if (checkedProp === undefined) {
      setInternalChecked(next);
    }
    onCheckedChange?.(next);
  };

  useEffect(() => {
    if (open && focusInnerOnOpenRef.current) {
      focusInnerOnOpenRef.current = false;
      innerRef.current?.focus();
    }
    if (!open) {
      // Any close voids a pending fire cycle (also covers controlled closes).
      if (fireTimerRef.current !== undefined) {
        clearTimeout(fireTimerRef.current);
        fireTimerRef.current = undefined;
      }
      setFired(false);
    }
  }, [open]);

  useEffect(
    () => () => {
      if (fireTimerRef.current !== undefined) {
        clearTimeout(fireTimerRef.current);
      }
    },
    [],
  );

  const handleGuardClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || fired) {
      return;
    }
    if (open) {
      // Slamming the guard over an armed switch throws it to safe first,
      // like the physical guard it emulates.
      if (armed) {
        setChecked(false);
      }
      setOpen(false, "toggle");
    } else {
      focusInnerOnOpenRef.current = event.detail === 0;
      setOpen(true, "toggle");
    }
  };

  const handleFire = (event: MouseEvent<HTMLButtonElement>) => {
    if (fired) {
      return;
    }
    setFired(true);
    onClick?.(event);
    // Refocus the guard before the well goes inert so focus is never stranded.
    guardRef.current?.focus();
    fireTimerRef.current = setTimeout(() => {
      fireTimerRef.current = undefined;
      setFired(false);
      setOpen(false, "fired");
    }, FIRE_HOLD_MS);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !open || event.key !== "Escape") {
      return;
    }
    // Handle Escape here so an enclosing overlay doesn't also close.
    event.preventDefault();
    event.stopPropagation();
    if (armed) {
      setChecked(false);
    }
    setOpen(false, "escape");
    guardRef.current?.focus();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);
    // While armed the open lid is the status display; blur never closes it
    // (and never changes checked state). Blur-close moves no focus — the user
    // already left; only aria-expanded flips.
    if (!open || armed) {
      return;
    }
    const next = event.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) {
      return;
    }
    setOpen(false, "focus");
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    if (!open || armed || fired) {
      return;
    }
    // A held press leaving mid-click must not slam the guard on the action.
    if (event.buttons !== 0) {
      return;
    }
    const active = document.activeElement;
    if (active && rootRef.current?.contains(active)) {
      return;
    }
    setOpen(false, "pointer");
  };

  const guardName = guardLabel
    ? `${guardLabel} guard`
    : typeof children === "string"
      ? `Guard for ${children}`
      : "Guard";

  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> imposes form semantics that aren't appropriate for a guard + control pairing (ButtonGroup's rationale)
    <div
      {...rest}
      ref={mergeRefs(rootRef, ref)}
      role="group"
      className={cx(styles.root, className)}
      data-mode={mode}
      data-orientation={orientation}
      data-size={size}
      data-tone={tone}
      data-elevation={elevation}
      data-open={open || undefined}
      data-armed={armed || undefined}
      data-fired={fired || undefined}
      data-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onPointerLeave={handlePointerLeave}
    >
      <button
        type="button"
        ref={guardRef}
        className={styles.guard}
        aria-expanded={open}
        aria-controls={wellId}
        aria-label={guardName}
        disabled={disabled}
        onClick={handleGuardClick}
      >
        <span className={styles.lid} aria-hidden="true">
          <span className={styles.lidFace}>{guardLabel}</span>
        </span>
      </button>
      <div id={wellId} className={styles.well} inert={open ? undefined : true}>
        {mode === "button" ? (
          <Button
            ref={innerRef}
            variant={tone}
            size={size}
            elevation={1}
            disabled={disabled}
            className={cx(styles.action, fired && styles.actionFired)}
            onClick={handleFire}
          >
            {children}
          </Button>
        ) : orientation === "vertical" ? (
          <>
            <span className={styles.mark} aria-hidden="true">
              ON
            </span>
            {/* A bat-handle toggle lever: Base UI Switch.Root keeps the
                role="switch" contract while the children draw the lever. */}
            <BaseSwitch.Root
              ref={innerRef}
              checked={checked}
              onCheckedChange={setChecked}
              disabled={disabled}
              aria-labelledby={labelId}
              className={styles.lever}
            >
              <span className={styles.leverBoss} />
              <span className={styles.leverArm} />
            </BaseSwitch.Root>
            <span className={styles.mark} aria-hidden="true">
              OFF
            </span>
            <span id={labelId} className={styles.armLabel}>
              {children}
            </span>
          </>
        ) : (
          <>
            <Switch
              ref={innerRef}
              checked={checked}
              onCheckedChange={setChecked}
              disabled={disabled}
              aria-labelledby={labelId}
            />
            <span id={labelId} className={styles.armLabel}>
              {children}
            </span>
          </>
        )}
      </div>
    </div>
  );
});
