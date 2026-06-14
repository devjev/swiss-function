import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef } from "react";

/** Pointer position during a drag, as deltas from the drag origin plus the
 *  absolute client coordinates. */
export interface DragDelta {
  /** Horizontal distance from where the drag started, in px. */
  dx: number;
  /** Vertical distance from where the drag started, in px. */
  dy: number;
  /** Absolute client x. */
  x: number;
  /** Absolute client y. */
  y: number;
}

export interface UsePointerDragOptions {
  /** Fired on pointerdown, once, before the first move. */
  onStart?: (origin: { x: number; y: number }, event: ReactPointerEvent) => void;
  /** Fired on every pointermove while dragging. Keep this cheap. */
  onMove: (delta: DragDelta, event: PointerEvent) => void;
  /** Fired on pointerup / pointercancel, once. */
  onEnd?: (delta: DragDelta, event: PointerEvent) => void;
}

/** Pure helper: pointer position expressed relative to the drag origin.
 *  Extracted so the delta math is unit-testable without a DOM. */
export function dragDelta(
  origin: { x: number; y: number },
  point: { x: number; y: number },
): DragDelta {
  return { dx: point.x - origin.x, dy: point.y - origin.y, x: point.x, y: point.y };
}

/**
 * Headless pointer-drag primitive. Generalizes the `Graph/Minimap` pattern:
 * captures the pointer on press so moves keep arriving even when the cursor
 * leaves the handle, and reports deltas relative to the press point.
 *
 * Refs (not state) hold the origin and latest options, so a drag produces no
 * React re-render of its own — the consumer's `onMove` decides what changes.
 */
export function usePointerDrag(options: UsePointerDragOptions): {
  onPointerDown: (event: ReactPointerEvent) => void;
} {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    // Primary button / primary contact only — ignore right-click, middle, etc.
    if (event.button !== 0 || !event.isPrimary) return;
    const target = event.currentTarget as HTMLElement;
    const origin = { x: event.clientX, y: event.clientY };
    originRef.current = origin;
    target.setPointerCapture(event.pointerId);
    // Suppress text selection / native image drag during the gesture.
    event.preventDefault();
    optionsRef.current.onStart?.(origin, event);

    const handleMove = (e: PointerEvent) => {
      const o = originRef.current;
      if (!o) return;
      optionsRef.current.onMove(dragDelta(o, { x: e.clientX, y: e.clientY }), e);
    };
    const handleEnd = (e: PointerEvent) => {
      const o = originRef.current;
      originRef.current = null;
      target.removeEventListener("pointermove", handleMove);
      target.removeEventListener("pointerup", handleEnd);
      target.removeEventListener("pointercancel", handleEnd);
      if (o) optionsRef.current.onEnd?.(dragDelta(o, { x: e.clientX, y: e.clientY }), e);
    };
    // With pointer capture, these fire on the captured element even when the
    // cursor is outside it.
    target.addEventListener("pointermove", handleMove);
    target.addEventListener("pointerup", handleEnd);
    target.addEventListener("pointercancel", handleEnd);
  }, []);

  return { onPointerDown };
}
