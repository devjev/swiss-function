/** Where annotation labels go so that two of them do not print over each
 *  other. Pure: text width comes in through `measure`.
 *
 *  Each label has a preferred spot and one alternative on the other side of
 *  its anchor. Labels are placed in array order: a label whose preferred spot
 *  overlaps one already placed takes its alternative, and keeps the preferred
 *  spot when both overlap. The result depends on the array alone, so a
 *  persisted set of annotations renders the same on every load. */

export type LabelAnchor = "start" | "middle" | "end";

export interface LabelSpot {
  /** Text x in px (meaning depends on `anchor`). */
  x: number;
  /** Text baseline y in px. */
  y: number;
  anchor: LabelAnchor;
}

export interface LabelRequest {
  text: string;
  /** Preferred spot first, then the alternatives in order. */
  spots: readonly LabelSpot[];
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The box a label occupies: `size` is the font size in px. */
export function labelBox(spot: LabelSpot, width: number, size: number): Box {
  const left =
    spot.anchor === "start" ? spot.x : spot.anchor === "end" ? spot.x - width : spot.x - width / 2;
  // The baseline sits about a fifth of the font size above the box's bottom.
  return { left, right: left + width, top: spot.y - size * 0.85, bottom: spot.y + size * 0.2 };
}

function overlaps(a: Box, b: Box, gap: number): boolean {
  return (
    a.left < b.right + gap &&
    b.left < a.right + gap &&
    a.top < b.bottom + gap &&
    b.top < a.bottom + gap
  );
}

/** Pick a spot per request (`null` for a request without spots), in order. */
export function placeAnnotationLabels(
  requests: readonly (LabelRequest | null)[],
  measure: (text: string) => number,
  size: number,
  gap = 2,
): (LabelSpot | null)[] {
  const placed: Box[] = [];
  return requests.map((request) => {
    const first = request?.spots[0];
    if (!request || !first) return null;
    const width = measure(request.text);
    let chosen = first;
    for (const spot of request.spots) {
      const box = labelBox(spot, width, size);
      if (!placed.some((p) => overlaps(box, p, gap))) {
        chosen = spot;
        break;
      }
    }
    placed.push(labelBox(chosen, width, size));
    return chosen;
  });
}
