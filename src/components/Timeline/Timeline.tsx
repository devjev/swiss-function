import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { assignLanes, type LaneInput } from "./lanes";
import styles from "./Timeline.module.css";
import { computeTicks } from "./ticks";

const MS_DAY = 24 * 60 * 60 * 1000;

interface TimelineContextValue {
  start: Date;
  end: Date;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

function useTimelineContext(): TimelineContextValue {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("<Timeline.Event> must be used inside <Timeline>");
  return ctx;
}

// --- Root --------------------------------------------------------------

export type TimelineSnap = "none" | "events" | "ticks";

export interface TimelineProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  start: Date;
  end: Date;
  /** Playhead position (controlled). When set, renders a draggable vertical
   *  scrubber line at this date. Clamped to [start, end] if out of range. */
  value?: Date;
  /** Fired on click + drag of the track with the date at the pointer's x.
   *  When omitted, the timeline is read-only (no scrub). */
  onChange?: (date: Date) => void;
  /** Scrub snapping behavior:
   *   - `"none"` (default): free, continuous position
   *   - `"events"`: snap to the nearest `<Timeline.Event>` date
   *   - `"ticks"`: snap to the nearest tick boundary (year/month/day/hour) */
  snap?: TimelineSnap;
  /** Container height. If omitted, sized to fit the lane count automatically. */
  height?: number | string;
  /** Render a faint vertical line at the current time. Default true. */
  showNow?: boolean;
  /** Maximum stacking lanes for label collision avoidance. Default 3. */
  maxLanes?: number;
  children?: ReactNode;
}

const Root = forwardRef<HTMLDivElement, TimelineProps>(function TimelineRoot(
  {
    start,
    end,
    value,
    onChange,
    snap = "none",
    height,
    showNow = true,
    maxLanes = 3,
    className,
    style,
    children,
    ...rest
  },
  _forwardedRef,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Set forwardRef while keeping internal ref for measurement.
  const setRef = (node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (typeof _forwardedRef === "function") _forwardedRef(node);
    else if (_forwardedRef) _forwardedRef.current = node;
  };

  const totalDays = (end.getTime() - start.getTime()) / MS_DAY;

  // Measure track width via ResizeObserver — used for lane collision math.
  // Visual positions are pure percentages so they don't depend on this.
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setMeasuredWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pixel density estimate for lane-collision detection only. Before first
  // measurement, use a sensible heuristic so first paint isn't blank.
  const layoutPxPerDay = measuredWidth != null && totalDays > 0 ? measuredWidth / totalDays : 4;

  const ticks = useMemo(
    () => computeTicks(start, end, layoutPxPerDay),
    [start, end, layoutPxPerDay],
  );

  // Now-line as a fraction of the total range, or null if out of range / disabled.
  const now = new Date();
  const nowInRange = showNow && now >= start && now <= end;
  const nowPct =
    nowInRange && totalDays > 0
      ? ((now.getTime() - start.getTime()) / MS_DAY / totalDays) * 100
      : null;

  // Playhead — clamped to [0, 100] so a stale `value` outside the range still
  // renders at the boundary instead of off-screen.
  const valuePct =
    value != null && totalDays > 0
      ? Math.max(0, Math.min(100, ((value.getTime() - start.getTime()) / MS_DAY / totalDays) * 100))
      : null;

  // --- Scrub handlers — convert a clientX on the track to a Date ---
  const isScrubbable = onChange != null;
  const dateFromClientX = (clientX: number): Date | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = new Date(start.getTime() + fraction * (end.getTime() - start.getTime()));
    return snapDate(raw, snap, snapCandidates);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const d = dateFromClientX(e.clientX);
    if (d) onChange?.(d);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbable) return;
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const d = dateFromClientX(e.clientX);
    if (d) onChange?.(d);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbable) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Walk children to collect events (in DOM order) and assign each a lane.
  const eventInputs = useMemo<LaneInput[]>(() => {
    const list: LaneInput[] = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      if (child.type !== Event) return;
      const props = child.props as TimelineEventProps;
      if (!(props.date instanceof Date)) return;
      list.push({ date: props.date, label: props.children });
    });
    return list;
  }, [children]);

  // Pre-compute snap candidates so the pointer handler doesn't allocate per move.
  const snapCandidates = useMemo<Date[]>(() => {
    if (snap === "events") return eventInputs.map((e) => e.date);
    if (snap === "ticks") return ticks.map((t) => t.date);
    return [];
  }, [snap, eventInputs, ticks]);

  const laneResult = useMemo(
    () => assignLanes(eventInputs, start, layoutPxPerDay, { maxLanes }),
    [eventInputs, start, layoutPxPerDay, maxLanes],
  );

  // Decorate each Event child with its assigned lane index.
  const decoratedChildren = useMemo(() => {
    let i = 0;
    return Children.map(children, (child) => {
      if (!isValidElement(child) || child.type !== Event) return child;
      const props = child.props as TimelineEventProps;
      if (!(props.date instanceof Date)) return child;
      const lane = laneResult.lanes[i++] ?? 0;
      return cloneElement(child as ReactElement<TimelineEventProps>, { lane });
    });
  }, [children, laneResult]);

  // Total height grows LINEARLY with lane count: 1.5u for ticks below the
  // axis + 0.25u gap + N × 1.25u for stacked event labels above. The axis
  // is anchored to a constant 1.5u from the bottom (not the vertical center),
  // so the empty space below ticks never grows with the label area.
  const numLanes = laneResult.maxLane + 1;

  const wrapperStyle: CSSProperties = {
    height: typeof height === "number" ? `${height}px` : height,
    "--sf-timeline-lanes": numLanes,
    ...style,
  } as CSSProperties;

  return (
    <TimelineContext.Provider value={{ start, end }}>
      <div {...rest} ref={setRef} className={cx(styles.viewport, className)} style={wrapperStyle}>
        <div
          ref={trackRef}
          className={styles.track}
          data-scrubbable={isScrubbable || undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Axis hairline at vertical center */}
          <div className={styles.axis} aria-hidden="true" />

          {/* Tick marks + labels — positioned with percentages so the layout
              scales with whatever width the track ends up at. */}
          {ticks.map((tick) => {
            const pct =
              totalDays > 0
                ? ((tick.date.getTime() - start.getTime()) / MS_DAY / totalDays) * 100
                : 0;
            return (
              <div
                key={tick.date.getTime()}
                className={cx(styles.tick, tick.major && styles.tickMajor)}
                style={{ left: `${pct}%` }}
                data-tick=""
                data-tick-major={tick.major || undefined}
              >
                <span className={styles.tickMark} aria-hidden="true" />
                <span className={styles.tickLabel}>{tick.label}</span>
              </div>
            );
          })}

          {/* "Now" line — drawn before events so events sit visually on top */}
          {nowPct != null ? (
            <div
              className={styles.now}
              style={{ left: `${nowPct}%` }}
              data-testid="timeline-now"
              aria-hidden="true"
            />
          ) : null}

          {/* Events with assigned lanes */}
          {decoratedChildren}

          {/* Playhead — interactive scrubber position; on top of everything */}
          {valuePct != null ? (
            <div
              className={styles.playhead}
              style={{ left: `${valuePct}%` }}
              data-testid="timeline-playhead"
              aria-hidden="true"
            >
              <span className={styles.playheadGrabber} />
            </div>
          ) : null}
        </div>
      </div>
    </TimelineContext.Provider>
  );
});

// --- Event -------------------------------------------------------------

export interface TimelineEventProps extends Omit<HTMLAttributes<HTMLDivElement>, "onClick"> {
  date: Date;
  onClick?: () => void;
  children?: ReactNode;
  /** @internal — assigned by <Timeline> via lane-collision avoidance. */
  lane?: number;
}

const Event = forwardRef<HTMLDivElement, TimelineEventProps>(function TimelineEvent(
  { date, onClick, className, children, lane = 0, ...rest },
  ref,
) {
  const { start, end } = useTimelineContext();
  const totalDays = (end.getTime() - start.getTime()) / MS_DAY;
  const pct = totalDays > 0 ? ((date.getTime() - start.getTime()) / MS_DAY / totalDays) * 100 : 0;

  // Stop pointerdown from bubbling so clicks on event markers don't trigger
  // the parent track's scrub handler.
  const stopScrub = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-down only stops scrub propagation; the inner button is the real interactive surface
    <div
      {...rest}
      ref={ref}
      className={cx(styles.event, className)}
      style={
        {
          left: `${pct}%`,
          "--sf-timeline-lane": lane,
        } as CSSProperties
      }
      data-event=""
      data-lane={lane}
      onPointerDown={stopScrub}
      onMouseDown={stopScrub}
    >
      <span className={styles.eventConnector} aria-hidden="true" />
      <span className={styles.eventLabel}>{children}</span>
      {onClick ? (
        <button
          type="button"
          className={cx(styles.eventMarker, styles.eventMarkerInteractive)}
          onClick={onClick}
          aria-label={typeof children === "string" ? children : "Timeline event"}
        />
      ) : (
        <span className={styles.eventMarker} aria-hidden="true" />
      )}
    </div>
  );
});

// --- Snap helper -------------------------------------------------------

function snapDate(raw: Date, mode: TimelineSnap, candidates: Date[]): Date {
  if (mode === "none" || candidates.length === 0) return raw;
  const target = raw.getTime();
  let nearest = candidates[0]!;
  let nearestDiff = Math.abs(target - nearest.getTime());
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const diff = Math.abs(target - c.getTime());
    if (diff < nearestDiff) {
      nearest = c;
      nearestDiff = diff;
    }
  }
  return nearest;
}

export const Timeline = Object.assign(Root, { Event });
