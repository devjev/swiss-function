import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";

/** How long a finger rests before a press is a long press (ms): the delay
 *  Android and Base UI's ContextMenu use. */
export const LONG_PRESS_DELAY = 500;
/** How far the finger may wander meanwhile (px). */
export const LONG_PRESS_TOLERANCE = 8;

/** Whether a finger has left the spot it pressed: past `tolerance` px from
 *  the origin in a straight line. */
export function movedPast(
  origin: { x: number; y: number },
  point: { x: number; y: number },
  tolerance: number,
): boolean {
  return Math.hypot(point.x - origin.x, point.y - origin.y) > tolerance;
}

export interface LongPressOptions {
  /** Rest time in ms. Default 500. */
  delay?: number;
  /** Allowed wander in px. Default 8. */
  tolerance?: number;
  /** Set `false` to switch the gesture off. Default `true`. */
  enabled?: boolean;
}

export interface LongPressHandlers {
  onPointerDownCapture: (event: ReactPointerEvent) => void;
  onPointerMoveCapture: (event: ReactPointerEvent) => void;
  onPointerUpCapture: (event: ReactPointerEvent) => void;
  onPointerCancelCapture: (event: ReactPointerEvent) => void;
}

/**
 * A long press with a finger: the touch form of a right click. iOS Safari
 * fires no `contextmenu` event on a long press, so a component that opens its
 * own menu from `onContextMenu` adds this beside it and opens the same menu.
 * Android fires `contextmenu` as well; opening a menu that is already open at
 * the same place changes nothing, so the two need no arbitration.
 *
 * Touch only: a mouse has its right button. The handlers are capture-phase,
 * so one set on a container sees a press on any row inside it, whatever the
 * row does with the event; the callback gets the pressed element to tell
 * which row it was. A finger that moves (a scroll, a drag) or lifts early
 * cancels the press.
 */
export function useLongPress(
  onLongPress: (point: { x: number; y: number }, target: Element) => void,
  {
    delay = LONG_PRESS_DELAY,
    tolerance = LONG_PRESS_TOLERANCE,
    enabled = true,
  }: LongPressOptions = {},
): LongPressHandlers {
  const callback = useRef(onLongPress);
  callback.current = onLongPress;
  const press = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);

  const cancel = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  return useMemo<LongPressHandlers>(
    () => ({
      onPointerDownCapture: (event) => {
        cancel();
        if (!enabled || event.pointerType !== "touch" || !event.isPrimary) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const point = { x: event.clientX, y: event.clientY };
        press.current = {
          id: event.pointerId,
          ...point,
          timer: window.setTimeout(() => {
            press.current = null;
            callback.current(point, target);
          }, delay),
        };
      },
      onPointerMoveCapture: (event) => {
        const p = press.current;
        if (!p || event.pointerId !== p.id) return;
        if (movedPast(p, { x: event.clientX, y: event.clientY }, tolerance)) cancel();
      },
      onPointerUpCapture: cancel,
      onPointerCancelCapture: cancel,
    }),
    [cancel, delay, tolerance, enabled],
  );
}
