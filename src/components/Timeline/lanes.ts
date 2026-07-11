import type { ReactNode } from "react";

const MS_DAY = 24 * 60 * 60 * 1000;

export interface LaneInput {
  date: Date;
  label: ReactNode;
}

export interface LaneOptions {
  /** Maximum number of stacked lanes. Events beyond this overflow into the
   *  top lane (where they may overlap previous labels). Default 3. */
  maxLanes?: number;
  /** Horizontal padding between adjacent labels in the same lane (px). Default 8. */
  gap?: number;
  /** Text-width function (px) for string/number labels. JSX labels always keep
   *  the flat 80px fallback — an arbitrary ReactNode can't be measured without
   *  DOM layout. Omitted: the ~7px-per-glyph estimate. */
  measure?: (label: unknown) => number;
  /** Track extent (px). A label that would run past it is overflow-flagged
   *  (hidden at rest, hover-revealed) instead of clipping mid-word at the
   *  container edge. Omitted: no edge clamping. */
  trackWidthPx?: number;
}

export interface LaneResult {
  /** Lane index per input event, parallel to the input array. */
  lanes: number[];
  /** Highest lane index actually used (0 for single-lane layouts). */
  maxLane: number;
  /** Parallel to the input array: true when the event's label could not be
   *  placed collision-free within maxLanes. The event keeps its (topmost-lane)
   *  assignment for the marker; the flag lets the renderer hide the label. */
  overflow: boolean[];
}

/**
 * Greedy interval scheduling — assign each event to the lowest lane where
 * its label doesn't collide with any previously-placed label in that lane.
 *
 * Algorithm: O(N × maxLanes). Sort by date, then for each event walk lanes
 * top-to-bottom looking for one whose rightmost-used x position is less than
 * this label's start x.
 */
export function assignLanes(
  events: LaneInput[],
  start: Date,
  pxPerDay: number,
  options: LaneOptions = {},
): LaneResult {
  const maxLanes = options.maxLanes ?? 3;
  const gap = options.gap ?? 8;
  if (events.length === 0) return { lanes: [], maxLane: 0, overflow: [] };

  // Sort by date while remembering original order so we can return lanes in input order.
  const indexed = events.map((e, originalIndex) => ({ ...e, originalIndex }));
  indexed.sort((a, b) => a.date.getTime() - b.date.getTime());

  const lanes = new Array<number>(events.length).fill(0);
  const overflow = new Array<boolean>(events.length).fill(false);
  // For each lane index, the rightmost x (px) consumed by a label so far.
  const laneRightX: number[] = [];
  let maxLaneUsed = 0;

  for (const event of indexed) {
    const days = (event.date.getTime() - start.getTime()) / MS_DAY;
    const eventX = days * pxPerDay; // marker x
    const labelWidth = estimateLabelWidth(event.label, options.measure);
    // Labels extend right from the marker (see Timeline.module.css .eventLabel).
    const labelStart = eventX;
    const labelEnd = eventX + labelWidth + gap;

    // Walk lanes top-to-bottom (low index = closest to axis) until we find one
    // whose previous label ended before this label's start.
    let lane = 0;
    while (lane < laneRightX.length && labelStart < (laneRightX[lane] ?? 0)) {
      lane++;
    }
    const clipsAtEdge = options.trackWidthPx !== undefined && labelEnd > options.trackWidthPx;
    if (lane >= maxLanes || clipsAtEdge) {
      // No collision-free lane (or the label would clip at the track edge):
      // park the marker in the topmost fitting lane and flag the label.
      // Flagged labels are hidden at rest, so they reserve no horizontal
      // space — a later event may still fit where this one couldn't.
      lane = Math.min(lane, maxLanes - 1);
      overflow[event.originalIndex] = true;
    } else {
      laneRightX[lane] = Math.max(laneRightX[lane] ?? 0, labelEnd);
    }
    lanes[event.originalIndex] = lane;
    if (lane > maxLaneUsed) maxLaneUsed = lane;
  }

  return { lanes, maxLane: maxLaneUsed, overflow };
}

/**
 * Label width for collision math: the injected `measure` (real text metrics)
 * when present, else ~7px per glyph at font-size-sm; either way + 8 for the
 * label's horizontal bg padding. JSX labels can't be measured without DOM
 * layout, so they keep a flat 80px regardless of `measure`.
 */
function estimateLabelWidth(label: ReactNode, measure?: (label: unknown) => number): number {
  if (typeof label === "string" || typeof label === "number") {
    return (measure ? measure(label) : String(label).length * 7) + 8;
  }
  // Arbitrary ReactNode (JSX) — fall back to a moderate default.
  return 80;
}
