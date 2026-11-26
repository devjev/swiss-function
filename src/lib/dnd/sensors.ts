import {
  KeyboardSensor,
  PointerSensor,
  type PointerSensorOptions,
  type SensorDescriptor,
  type SensorOptions,
  TouchSensor,
  type TouchSensorOptions,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react";

/** How far a mouse or pen must travel before a press becomes a drag (px), so
 *  a plain click still sorts, selects or resizes. */
export const DRAG_DISTANCE = 4;
/** How long a finger must rest before a press becomes a drag (ms). A finger
 *  that moves sooner is scrolling. */
export const TOUCH_DRAG_DELAY = 250;
/** How far a resting finger may wander during that delay (px). */
export const TOUCH_DRAG_TOLERANCE = 8;

/** Whether a press landed on a dedicated drag handle: an element, between the
 *  press target and the element that carries the drag listeners, that set
 *  `touch-action: none`. Such an element can do nothing else with a finger, so
 *  it drags as it does for a mouse. A row or a heading that still scrolls and
 *  taps (no `touch-action: none`) waits for the finger to rest. Pure but for `getComputedStyle`, which the caller injects in
 *  tests. */
export function isTouchHandle(
  target: EventTarget | null,
  boundary: Element | null | undefined,
  touchActionOf: (el: Element) => string = (el) => getComputedStyle(el).touchAction,
): boolean {
  let el = target instanceof Element ? target : null;
  // Bounded even without a boundary: a handle is the target or close above it.
  for (let depth = 0; el && depth < 8; depth++) {
    if (touchActionOf(el) === "none") return true;
    if (el === boundary) return false;
    el = el.parentElement;
  }
  return false;
}

/** The pointer sensor: a mouse or a pen anywhere, and a finger on a drag
 *  handle. A pointer-event drag cannot stop the browser from scrolling, so
 *  with a finger it only works where the element gave up touch scrolling
 *  (`touch-action: none`); anywhere else a finger goes to the touch sensor. */
class HandlePointerSensor extends PointerSensor {
  static override activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (
        { nativeEvent: event, currentTarget }: ReactPointerEvent,
        { onActivation }: PointerSensorOptions,
      ) => {
        if (!event.isPrimary || event.button !== 0) return false;
        if (event.pointerType === "touch" && !isTouchHandle(event.target, currentTarget)) {
          return false;
        }
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/** The touch sensor, for a finger on anything that still scrolls: it waits
 *  for the finger to rest, then holds the page still for the drag. A press on
 *  a handle is the pointer sensor's, so the two never claim the same press. */
class RestingTouchSensor extends TouchSensor {
  static override activators = [
    {
      eventName: "onTouchStart" as const,
      handler: (
        { nativeEvent: event, currentTarget }: ReactTouchEvent,
        { onActivation }: TouchSensorOptions,
      ) => {
        if (event.touches.length > 1 || isTouchHandle(event.target, currentTarget)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

export interface SfSensorOptions {
  /** Add the keyboard sensor (Space to lift, arrows to move, Space to drop)
   *  for widgets whose drag has a focusable grip. Default `false`. */
  keyboard?: boolean;
}

/**
 * The sensors every swiss-function drag uses, so a drag behaves the same in
 * each widget and in a host's `SfDndProvider`:
 *
 * - a mouse or a pen drags after `DRAG_DISTANCE` px of travel, and so does a
 *   finger on a drag handle (an element with `touch-action: none`);
 * - a finger anywhere else drags after resting `TOUCH_DRAG_DELAY` ms (moving
 *   sooner scrolls the page, as it does everywhere);
 * - with `keyboard`, the focused grip takes Space and the arrows.
 *
 * The touch sensor keeps one non-passive `touchmove` listener on the window
 * while a drag context is mounted (dnd-kit needs it to stop a scroll once the
 * drag starts).
 */
export function useSfSensors({
  keyboard = false,
}: SfSensorOptions = {}): SensorDescriptor<SensorOptions>[] {
  const pointer = useSensor(HandlePointerSensor, {
    activationConstraint: { distance: DRAG_DISTANCE },
  });
  const touch = useSensor(RestingTouchSensor, {
    activationConstraint: { delay: TOUCH_DRAG_DELAY, tolerance: TOUCH_DRAG_TOLERANCE },
  });
  const keys = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  return useSensors(pointer, touch, keyboard ? keys : null);
}
