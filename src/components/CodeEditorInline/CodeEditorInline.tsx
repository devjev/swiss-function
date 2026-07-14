import type { EditorView } from "@codemirror/view";
import type { CSSProperties, FocusEvent } from "react";
import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import { CodeEditor, type CodeEditorProps } from "../CodeEditor";
import styles from "./CodeEditorInline.module.css";

export type CodeEditorInlineSize = "sm" | "md" | "lg";

export interface CodeEditorInlineProps extends CodeEditorProps {
  /** Resting one-line height, matching the control ladder: `sm` ≈ 1u / `md` ≈
   *  1.5u / `lg` ≈ 2u. Scales the code font and padding together. Default `md`. */
  size?: CodeEditorInlineSize;
  /** Max code lines the expanded overlay grows to before it scrolls. Default 12. */
  maxRows?: number;
  /** Resting (collapsed) depth on the `--sf-elevation-N` scale. Default 1; the
   *  expanded overlay is always elevation 3, the active-surface cue. */
  collapsedElevation?: BoxElevation;
}

/**
 * A CodeEditor that rests as a single line and expands to a full multi-line
 * editor on focus, the code sibling of {@link ../TextEditInline}. The editor is
 * always mounted (so undo history and cursor survive), and it stays a real
 * CodeMirror instance while collapsed — the first line shows *syntax-highlighted*,
 * so the resting state is a live preview, not a dead label.
 *
 * Expanded, the editor is absolutely positioned so it *overlays* the content
 * below (elevation-3) instead of pushing it down; it grows with the document up
 * to `maxRows`, then scrolls. Blurring collapses it back to one line. The
 * one-line and `maxRows` heights are measured from the live editor's line height.
 */
export const CodeEditorInline = forwardRef<HTMLDivElement, CodeEditorInlineProps>(
  function CodeEditorInline(
    {
      size = "md",
      maxRows = 12,
      collapsedElevation = 1,
      lineNumbers = false,
      className,
      style,
      onCreateEditor,
      ...rest
    },
    ref,
  ) {
    const [focused, setFocused] = useState(false);
    // One-line and maxRows heights, measured from the mounted editor's line
    // height; CSS falls back to sane defaults until the first measure lands.
    const [collapsed, setCollapsed] = useState<number | null>(null);
    const [maxHeight, setMaxHeight] = useState<number | null>(null);
    // The CodeEditor's own root, so we can clear the inline height the browser
    // writes when the user drags the resize handle — otherwise it would override
    // the CSS one-line height and the control couldn't collapse.
    const editorRootRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    useLayoutEffect(() => {
      if (!focused) editorRootRef.current?.style.removeProperty("height");
    }, [focused]);

    const measure = useCallback(() => {
      const view = viewRef.current;
      if (!view) return;
      const line = view.defaultLineHeight || 20;
      const cs = getComputedStyle(view.contentDOM);
      const padY =
        (Number.parseFloat(cs.paddingTop) || 0) + (Number.parseFloat(cs.paddingBottom) || 0);
      const border = 2; // the CodeEditor root's 1px top + bottom
      setCollapsed(Math.round(line + padY + border));
      setMaxHeight(Math.round(line * maxRows + padY + border));
    }, [maxRows]);

    // `defaultLineHeight` is font-dependent and can read short before the mono
    // webfont applies, which would leave the collapsed box too short (the line
    // clips top-heavy). Re-measure after layout and once fonts are ready.
    // Re-run on `size` too: it swaps the code font, which changes the line
    // height the collapsed footprint is derived from.
    useEffect(() => {
      const raf = requestAnimationFrame(measure);
      document.fonts?.ready.then(measure).catch(() => {});
      return () => cancelAnimationFrame(raf);
    }, [measure, size]);

    // Collapse only when focus leaves the whole control, not when it moves
    // between the editor's inner parts (e.g. into an autocomplete tooltip).
    const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
    };

    const rootStyle = {
      ...style,
      ...(collapsed != null ? { "--cei-collapsed": `${collapsed}px` } : null),
      ...(maxHeight != null ? { "--cei-max": `${maxHeight}px` } : null),
    } as CSSProperties;

    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: focus delegation only — the focusable surface is the CodeMirror editor inside; the wrapper just tracks focus-within to expand/collapse.
      <div
        ref={ref}
        className={cx(styles.root, className)}
        style={rootStyle}
        data-size={size === "md" ? undefined : size}
        data-expanded={focused || undefined}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
      >
        <CodeEditor
          {...rest}
          ref={editorRootRef}
          className={styles.editor}
          lineNumbers={lineNumbers}
          elevation={focused ? 3 : collapsedElevation}
          onCreateEditor={(view) => {
            viewRef.current = view;
            measure();
            onCreateEditor?.(view);
          }}
        />
      </div>
    );
  },
);
