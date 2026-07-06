import type { TextareaHTMLAttributes } from "react";
import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import styles from "./TextEditInline.module.css";

export type TextEditInlineSize = "sm" | "md" | "lg";

export interface TextEditInlineProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Resting single-line height, matching Input: `sm` 1u / `md` 1.5u / `lg` 2u. */
  size?: TextEditInlineSize;
  /** Max lines the expanded overlay grows to before it scrolls. Default 8. */
  maxRows?: number;
}

const sizeClass: Record<TextEditInlineSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
  lg: styles.sizeLg ?? "",
};

/**
 * A TextEdit that rests as a single line and expands to a multi-line editor on
 * interaction. The expanded textarea is absolutely positioned, so it *overlays*
 * the content below (elevation-3) instead of pushing it down; leaving (blur +
 * pointer-out) collapses it back to one line with an ellipsis when it overflows.
 *
 * Collapsed, a decorative preview `<div>` renders the value on one ellipsized
 * line (a `<textarea>` can't paint `text-overflow: ellipsis`). The real textarea
 * stays behind it — focusable via keyboard and clickable through the
 * pointer-transparent preview — so expansion is driven purely by hover + focus.
 */
export const TextEditInline = forwardRef<HTMLTextAreaElement, TextEditInlineProps>(
  function TextEditInline(
    {
      size = "md",
      maxRows = 8,
      className,
      style,
      value,
      defaultValue,
      placeholder,
      onChange,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) {
    const areaRef = useRef<HTMLTextAreaElement>(null);
    const setRefs = mergeRefs<HTMLTextAreaElement>(ref, areaRef);
    // Once the user drags the resize handle we stop auto-sizing and let their
    // height stand; `lastAuto` is the height *we* set, so the ResizeObserver can
    // tell a manual drag from our own adjustment.
    const userResized = useRef(false);
    const lastAuto = useRef(0);

    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const expanded = hovered || focused;

    // Mirror the value so the collapsed preview stays in sync when uncontrolled.
    const isControlled = value !== undefined;
    const [internal, setInternal] = useState(() => String(defaultValue ?? ""));
    const text = isControlled ? String(value ?? "") : internal;

    // Grow the overlay to fit its content, capped at `maxRows` (then it scrolls).
    const autosize = useCallback(() => {
      const el = areaRef.current;
      if (!el || userResized.current) return;
      const cs = getComputedStyle(el);
      const line = Number.parseFloat(cs.lineHeight) || 0;
      const padding = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
      const border = Number.parseFloat(cs.borderTopWidth) + Number.parseFloat(cs.borderBottomWidth);
      const max = line * maxRows + padding + border;
      el.style.height = "auto";
      // scrollHeight excludes the border, but height is border-box — add it back.
      const needed = el.scrollHeight + border;
      const h = Math.min(needed, max);
      el.style.height = `${h}px`;
      el.style.overflowY = needed > max ? "auto" : "hidden";
      lastAuto.current = h;
    }, [maxRows]);

    // Size the overlay while expanded; hand height back to CSS when collapsed.
    // `text` is a dep (not read here) so a controlled value change re-measures.
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on value change
    useLayoutEffect(() => {
      const el = areaRef.current;
      if (!el) return;
      if (expanded) {
        autosize();
      } else {
        userResized.current = false;
        lastAuto.current = 0;
        el.style.height = "";
        el.style.overflowY = "";
      }
    }, [expanded, autosize, text]);

    // Detect a manual resize-handle drag: a height change we didn't make. From
    // then on autosize yields (guard above) so the user's height sticks.
    useLayoutEffect(() => {
      const el = areaRef.current;
      if (!el || !expanded || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => {
        if (userResized.current) return;
        if (Math.abs(el.offsetHeight - lastAuto.current) > 1) {
          userResized.current = true;
          el.style.overflowY = "auto";
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, [expanded]);

    return (
      // Pointer only toggles the preview; keyboard users reach the same
      // expansion via focus (onFocus), so no key handler is required here.
      <div
        className={cx(styles.root, sizeClass[size], className)}
        style={style}
        data-expanded={expanded || undefined}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <textarea
          {...rest}
          ref={setRefs}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={1}
          className={styles.area}
          onChange={(e) => {
            if (!isControlled) setInternal(e.target.value);
            onChange?.(e);
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {!expanded ? (
          <div
            className={cx(styles.preview, text ? undefined : styles.placeholder)}
            aria-hidden="true"
          >
            {text || placeholder || ""}
          </div>
        ) : null}
      </div>
    );
  },
);
