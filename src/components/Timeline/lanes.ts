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
}

export interface LaneResult {
  /** Lane index per input event, parallel to the input array. */
  lanes: number[];
  /** Highest lane index actually used (0 for single-lane layouts). */
  maxLane: number;
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
  if (events.length === 0) return { lanes: [], maxLane: 0 };

  // Sort by date while remembering original order so we can return lanes in input order.
  const indexed = events.map((e, originalIndex) => ({ ...e, originalIndex }));
  indexed.sort((a, b) => a.date.getTime() - b.date.getTime());

  const lanes = new Array<number>(events.length).fill(0);
  // For each lane index, the rightmost x (px) consumed by a label so far.
  const laneRightX: number[] = [];
  let maxLaneUsed = 0;

  for (const event of indexed) {
    const days = (event.date.getTime() - start.getTime()) / MS_DAY;
    const eventX = days * pxPerDay; // marker x
    const labelWidth = estimateLabelWidth(event.label);
    // Labels extend right from the marker (see Timeline.module.css .eventLabel).
    const labelStart = eventX;
    const labelEnd = eventX + labelWidth + gap;

    // Walk lanes top-to-bottom (low index = closest to axis) until we find one
    // whose previous label ended before this label's start.
    let lane = 0;
    while (lane < laneRightX.length && labelStart < (laneRightX[lane] ?? 0)) {
      lane++;
    }
    if (lane >= maxLanes) lane = maxLanes - 1; // overflow into the topmost allowed lane

    laneRightX[lane] = Math.max(laneRightX[lane] ?? 0, labelEnd);
    lanes[event.originalIndex] = lane;
    if (lane > maxLaneUsed) maxLaneUsed = lane;
  }

  return { lanes, maxLane: maxLaneUsed };
}

/**
 * Width estimate without DOM measurement — ~7px per glyph at font-size-sm,
 * plus the label's 4px-each-side bg padding. Imprecise but adequate for lane
 * assignment since labels are short and the gap absorbs slack.
 */
function estimateLabelWidth(label: ReactNode): number {
  if (typeof label === "string") return label.length * 7 + 8;
  if (typeof label === "number") return String(label).length * 7 + 8;
  // Arbitrary ReactNode (JSX) — fall back to a moderate default.
  return 80;
}
