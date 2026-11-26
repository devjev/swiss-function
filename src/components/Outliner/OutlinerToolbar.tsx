import type { Ref, SyntheticEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/cx";
import { Glyph, type IconRenderer, type IconSlot } from "../../lib/icons";
import { usePortalContainer } from "../../lib/portalContainer";
import { useStackLayer, Z_LAYER } from "../../lib/stacking";
import { ArrowDown, ArrowUp, Indent, KeyboardHide, Outdent, Redo, Task, Undo } from "../Icon";
import styles from "./Outliner.module.css";
import { keyboardInset, type OutlinerCommand } from "./toolbar";

interface Key {
  command: OutlinerCommand;
  label: string;
  slot: IconSlot;
  fallback: IconRenderer;
  /** The first key of a group: a hairline sets it off from the group before. */
  lead?: boolean;
}

/** The keys that scroll, in order. The key that leaves the text is apart, at
 *  the bar's end, so it stays in reach on a narrow screen. */
const KEYS: readonly Key[] = [
  { command: "outdent", label: "Outdent", slot: "outdent", fallback: Outdent },
  { command: "indent", label: "Indent", slot: "indent", fallback: Indent },
  { command: "moveUp", label: "Move up", slot: "arrowUp", fallback: ArrowUp, lead: true },
  { command: "moveDown", label: "Move down", slot: "arrowDown", fallback: ArrowDown },
  { command: "task", label: "Toggle task", slot: "task", fallback: Task, lead: true },
  { command: "undo", label: "Undo", slot: "undo", fallback: Undo, lead: true },
  { command: "redo", label: "Redo", slot: "redo", fallback: Redo },
];

const DONE: Key = {
  command: "done",
  label: "Done",
  slot: "keyboardHide",
  fallback: KeyboardHide,
};

/** A press on the bar must not take the focus: the caret stays in the block's
 *  text, and with it the on-screen keyboard. */
const keepFocus = (e: SyntheticEvent) => e.preventDefault();

/** The height the on-screen keyboard covers at the bottom of `view`, live. */
function useKeyboardInset(view: Window | null): number {
  const [inset, setInset] = useState(0);
  useLayoutEffect(() => {
    if (!view) return;
    const viewport = view.visualViewport;
    const update = () => setInset(keyboardInset(view.innerHeight, viewport));
    update();
    // The keyboard resizes the visual viewport; a pan under it scrolls it.
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    view.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      view.removeEventListener("resize", update);
    };
  }, [view]);
  return inset;
}

/** Scroll what holds `from` up by `by` px: its scrolling ancestors first, the
 *  innermost one out, then the page. */
export function scrollUpBy(from: HTMLElement, by: number): void {
  const doc = from.ownerDocument;
  const view = doc.defaultView;
  if (!view) return;
  let left = by;
  for (let el = from.parentElement; el && left >= 1; el = el.parentElement) {
    if (el === doc.documentElement) break;
    if (el.scrollHeight <= el.clientHeight) continue;
    const overflow = view.getComputedStyle(el).overflowY;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    const before = el.scrollTop;
    el.scrollTop = before + left;
    left -= el.scrollTop - before;
  }
  if (left >= 1) view.scrollBy({ top: left, behavior: "instant" });
}

export interface OutlinerToolbarProps {
  /** The bar's element, for the outline: a press on it is not a press outside
   *  the outline, and the block being edited is kept above it. */
  barRef: Ref<HTMLDivElement>;
  /** The body of the document the outline is in. A `PortalContainerProvider`
   *  (a popped-out window) takes precedence. */
  container: HTMLElement | null;
  /** The commands that would do nothing now: their keys are disabled. */
  disabled: ReadonlySet<OutlinerCommand>;
  onCommand: (command: OutlinerCommand) => void;
  /** The bar took its place, or moved with the keyboard: `inset` is the
   *  height the keyboard covers under it, in px. */
  onPlaced: (inset: number) => void;
}

/**
 * The outline's touch toolbar: the structure commands an on-screen keyboard
 * has no keys for, as a bar along the bottom edge of the visible page, directly
 * above the keyboard. It is shown while a block is being edited.
 */
export function OutlinerToolbar({
  barRef,
  container,
  disabled,
  onCommand,
  onPlaced,
}: OutlinerToolbarProps) {
  const provided = usePortalContainer();
  const target = provided ?? container;
  const inset = useKeyboardInset(target?.ownerDocument.defaultView ?? null);
  // Above a Dialog, a Drawer or an expanded Fullscreen the outline sits in.
  const layer = useStackLayer(Z_LAYER.overlay, false);

  const placed = useRef(onPlaced);
  placed.current = onPlaced;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the bar moves
  useLayoutEffect(() => {
    placed.current(inset);
  }, [inset, target]);

  if (!target) return null;

  const renderKey = ({ command, label, slot, fallback, lead }: Key, done = false) => {
    const off = disabled.has(command);
    return (
      <button
        key={command}
        type="button"
        className={cx(styles.toolbarKey, done && styles.toolbarDone)}
        data-command={command}
        data-lead={lead || undefined}
        aria-label={label}
        // Not the `disabled` attribute: a press on a disabled button is not
        // reported, so it could not be kept from taking the focus.
        aria-disabled={off || undefined}
        // A touch affordance: the keyboard has the chords.
        tabIndex={-1}
        onClick={() => {
          if (!off) onCommand(command);
        }}
      >
        <Glyph slot={slot} fallback={fallback} size={1} />
      </button>
    );
  };

  return createPortal(
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Outline commands"
      className={styles.toolbar}
      data-outliner-toolbar=""
      // Over the bottom edge of the window, the bar clears the home indicator.
      data-docked={inset === 0 || undefined}
      style={{ insetBlockEnd: inset, zIndex: layer.zIndex }}
      onPointerDown={keepFocus}
      onMouseDown={keepFocus}
    >
      <div className={styles.toolbarKeys}>{KEYS.map((key) => renderKey(key))}</div>
      {renderKey(DONE, true)}
    </div>,
    target,
  );
}
