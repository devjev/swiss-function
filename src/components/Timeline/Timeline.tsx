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
  /** Range selection (controlled): a `[start, end]` pair rendered as two draggable
   *  handles with a highlighted band between them. Takes over from the single
   *  playhead; pass with `onRangeChange`. */
  rangeValue?: [Date, Date];
  /** Fired while dragging a range handle, the band, or clicking the track, with
   *  the new `[start, end]` pair (clamped to the timeline and never crossed). */
  onRangeChange?: (range: [Date, Date]) => void;
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
  /** Compact strip: hide event labels at rest (revealed on hover/focus, and for
   *  the event nearest the playhead while scrubbing) and collapse to one lane. */
  compact?: boolean;
  /** Wrap the strip in an Input-style border (1px + radius). Default false. */
  bordered?: boolean;
  /** Resting depth — same `--sf-elevation-N` scale as Box / Input (0–5). Pairs
   *  with `bordered`. Default 0 (flat). */
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Float a small value tag above the playhead / range handles. Default false. */
  valueLabel?: boolean;
  /** Format a scrub-head value for its tag. Default: `YYYY-MM-DD`. */
  formatValue?: (date: Date) => ReactNode;
  children?: ReactNode;
}

const Root = forwardRef<HTMLDivElement, TimelineProps>(function TimelineRoot(
  {
    start,
    end,
    value,
    onChange,
    rangeValue,
    onRangeChange,
    snap = "none",
    height,
    showNow = true,
    maxLanes = 3,
    compact = false,
    bordered = false,
    elevation = 0,
    valueLabel = false,
    formatValue,
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

  // Fraction → percent (clamped, so a stale value outside the range renders at
  // the boundary instead of off-screen).
  const pct = (d: Date): number =>
    totalDays > 0
      ? Math.max(0, Math.min(100, ((d.getTime() - start.getTime()) / MS_DAY / totalDays) * 100))
      : 0;
  const valuePct = value != null ? pct(value) : null;
  const fmtValue = formatValue ?? defaultFormatValue;

  // Range selection takes over from the single playhead when both props are set.
  const rangeMode = rangeValue != null && onRangeChange != null;
  const rangeStartPct = rangeValue ? pct(rangeValue[0]) : null;
  const rangeEndPct = rangeValue ? pct(rangeValue[1]) : null;

  // --- Pointer → Date helpers ---
  const rawDateFromClientX = (clientX: number): Date | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return new Date(start.getTime() + fraction * (end.getTime() - start.getTime()));
  };
  const dateFromClientX = (clientX: number): Date | null => {
    const raw = rawDateFromClientX(clientX);
    return raw ? snapDate(raw, snap, snapCandidates) : null;
  };
  const clampMs = (ms: number) => Math.max(start.getTime(), Math.min(end.getTime(), ms));

  const isScrubbable = onChange != null && !rangeMode;
  const [scrubbing, setScrubbing] = useState(false);

  // Which range bound (or the band) a drag is moving; a ref so moves don't
  // re-render. Captured bounds let the band translate while preserving width.
  const rangeDrag = useRef<{
    target: "start" | "end" | "region";
    grabMs: number;
    startMs: number;
    endMs: number;
  } | null>(null);

  const applyRangeDrag = (clientX: number) => {
    const dr = rangeDrag.current;
    if (!dr || !onRangeChange) return;
    if (dr.target === "region") {
      const raw = rawDateFromClientX(clientX);
      if (!raw) return;
      const width = dr.endMs - dr.startMs;
      const s = Math.max(
        start.getTime(),
        Math.min(end.getTime() - width, dr.startMs + (raw.getTime() - dr.grabMs)),
      );
      onRangeChange([new Date(s), new Date(s + width)]);
    } else {
      const at = dateFromClientX(clientX);
      if (!at) return;
      if (dr.target === "start") {
        onRangeChange([new Date(Math.min(clampMs(at.getTime()), dr.endMs)), new Date(dr.endMs)]);
      } else {
        onRangeChange([
          new Date(dr.startMs),
          new Date(Math.max(clampMs(at.getTime()), dr.startMs)),
        ]);
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rangeValue && onRangeChange) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setScrubbing(true);
      const raw = rawDateFromClientX(e.clientX);
      if (!raw) return;
      const hit = (e.target as HTMLElement).closest("[data-bound]") as HTMLElement | null;
      let target = hit?.dataset.bound as "start" | "end" | "region" | undefined;
      if (!target) {
        // Empty track — grab the nearer bound.
        const at = dateFromClientX(e.clientX) ?? raw;
        target =
          Math.abs(at.getTime() - rangeValue[0].getTime()) <=
          Math.abs(at.getTime() - rangeValue[1].getTime())
            ? "start"
            : "end";
      }
      rangeDrag.current = {
        target,
        grabMs: raw.getTime(),
        startMs: rangeValue[0].getTime(),
        endMs: rangeValue[1].getTime(),
      };
      if (target !== "region") applyRangeDrag(e.clientX);
      return;
    }
    if (!isScrubbable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    const d = dateFromClientX(e.clientX);
    if (d) onChange?.(d);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (rangeMode) {
      applyRangeDrag(e.clientX);
      return;
    }
    if (!isScrubbable) return;
    const d = dateFromClientX(e.clientX);
    if (d) onChange?.(d);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setScrubbing(false);
    rangeDrag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Keyboard: arrows nudge a focused range handle by 1% of the span.
  const nudgeRange = (target: "start" | "end") => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!rangeValue || !onRangeChange) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const stepMs = ((end.getTime() - start.getTime()) / 100) * (e.key === "ArrowRight" ? 1 : -1);
    if (target === "start") {
      onRangeChange([
        new Date(Math.min(clampMs(rangeValue[0].getTime() + stepMs), rangeValue[1].getTime())),
        rangeValue[1],
      ]);
    } else {
      onRangeChange([
        rangeValue[0],
        new Date(Math.max(clampMs(rangeValue[1].getTime() + stepMs), rangeValue[0].getTime())),
      ]);
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

  // Compact strips collapse to a single lane (labels are transient, so they
  // don't need collision-avoidance stacking).
  const effectiveMaxLanes = compact ? 1 : maxLanes;
  const laneResult = useMemo(
    () => assignLanes(eventInputs, start, layoutPxPerDay, { maxLanes: effectiveMaxLanes }),
    [eventInputs, start, layoutPxPerDay, effectiveMaxLanes],
  );

  // While scrubbing a compact timeline, reveal the label of the event nearest
  // the playhead so the scrub has context.
  const activeEventIdx = useMemo(() => {
    if (!compact || !scrubbing || value == null || eventInputs.length === 0) return -1;
    let best = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    eventInputs.forEach((e, i) => {
      const diff = Math.abs(e.date.getTime() - value.getTime());
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    });
    return best;
  }, [compact, scrubbing, value, eventInputs]);

  // Decorate each Event child with its assigned lane index (+ active flag).
  const decoratedChildren = useMemo(() => {
    let i = 0;
    return Children.map(children, (child) => {
      if (!isValidElement(child) || child.type !== Event) return child;
      const props = child.props as TimelineEventProps;
      if (!(props.date instanceof Date)) return child;
      const idx = i++;
      const lane = laneResult.lanes[idx] ?? 0;
      return cloneElement(child as ReactElement<TimelineEventProps>, {
        lane,
        active: idx === activeEventIdx,
      });
    });
  }, [children, laneResult, activeEventIdx]);

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
      <div
        {...rest}
        ref={setRef}
        className={cx(styles.viewport, className)}
        style={wrapperStyle}
        data-compact={compact || undefined}
        data-bordered={bordered || undefined}
        data-elevation={elevation || undefined}
        data-value-label={valueLabel || undefined}
        data-scrubbing={scrubbing || undefined}
      >
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
              {valueLabel && value != null ? (
                <span className={styles.scrubValue}>{fmtValue(value)}</span>
              ) : null}
              <span className={styles.playheadGrabber} />
            </div>
          ) : null}

          {/* Range selection — a draggable band between two handles */}
          {rangeStartPct != null && rangeEndPct != null ? (
            <>
              <div
                className={styles.rangeRegion}
                data-bound="region"
                style={{ left: `${rangeStartPct}%`, width: `${rangeEndPct - rangeStartPct}%` }}
                data-testid="timeline-range-region"
                aria-hidden="true"
              />
              <div
                className={styles.rangeHandle}
                data-bound="start"
                style={{ left: `${rangeStartPct}%` }}
                role="slider"
                tabIndex={0}
                aria-label="Range start"
                aria-valuemin={start.getTime()}
                aria-valuemax={end.getTime()}
                aria-valuenow={rangeValue ? rangeValue[0].getTime() : undefined}
                aria-valuetext={rangeValue ? rangeValue[0].toISOString() : undefined}
                data-testid="timeline-range-start"
                onKeyDown={nudgeRange("start")}
              >
                {valueLabel && rangeValue ? (
                  <span className={styles.scrubValue}>{fmtValue(rangeValue[0])}</span>
                ) : null}
                <span className={styles.playheadGrabber} />
              </div>
              <div
                className={styles.rangeHandle}
                data-bound="end"
                style={{ left: `${rangeEndPct}%` }}
                role="slider"
                tabIndex={0}
                aria-label="Range end"
                aria-valuemin={start.getTime()}
                aria-valuemax={end.getTime()}
                aria-valuenow={rangeValue ? rangeValue[1].getTime() : undefined}
                aria-valuetext={rangeValue ? rangeValue[1].toISOString() : undefined}
                data-testid="timeline-range-end"
                onKeyDown={nudgeRange("end")}
              >
                {valueLabel && rangeValue ? (
                  <span className={styles.scrubValue}>{fmtValue(rangeValue[1])}</span>
                ) : null}
                <span className={styles.playheadGrabber} />
              </div>
            </>
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
  /** @internal — set by <Timeline> to reveal this label while scrubbing. */
  active?: boolean;
}

const Event = forwardRef<HTMLDivElement, TimelineEventProps>(function TimelineEvent(
  { date, onClick, className, children, lane = 0, active, ...rest },
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
      data-active={active || undefined}
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

/** Default scrub-value formatter — ISO `YYYY-MM-DD`. */
function defaultFormatValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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
