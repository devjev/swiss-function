import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";
import type { Camera } from "./projection";

export interface UseOrbitOptions {
  /** Starting camera. Default a 3/4 view (azimuth -0.6, elevation 0.5). */
  initial?: Camera;
}

export interface UseOrbitResult {
  camera: Camera;
  dragging: boolean;
  /** Spread onto the canvas (or its wrapper). */
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
  };
}

const DEFAULT: Camera = { azimuth: -0.6, elevation: 0.5 };
// Keep elevation off the poles so the cube never degenerates to a line.
const EL_MIN = -Math.PI / 2 + 0.05;
const EL_MAX = Math.PI / 2 - 0.05;
const SPEED = 0.01; // radians per px

/**
 * Drag-to-orbit camera for the 3D charts. Pointer-driven only — no inertia, no
 * auto-spin, no animation loop — so it renders on demand and honors
 * `prefers-reduced-motion` by construction (the idle view is a fixed angle).
 */
export function useOrbit({ initial = DEFAULT }: UseOrbitOptions = {}): UseOrbitResult {
  const [camera, setCamera] = useState<Camera>(initial);
  const [dragging, setDragging] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    last.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!last.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setCamera((c) => ({
      azimuth: c.azimuth - dx * SPEED,
      elevation: Math.min(EL_MAX, Math.max(EL_MIN, c.elevation + dy * SPEED)),
    }));
  }, []);

  const end = useCallback((e: ReactPointerEvent) => {
    last.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return {
    camera,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
  };
}
