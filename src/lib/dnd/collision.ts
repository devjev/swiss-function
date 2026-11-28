import { type CollisionDetection, rectIntersection } from "@dnd-kit/core";
import { SF_REGION_KEY } from "./context";

/** Collision detection for one of a widget's regions that leaves a sibling
 *  region's droppables out before intersecting, so a header drag never
 *  resolves over a tree row (and the other way round). Droppables of other
 *  widgets and of the host stay in, which keeps cross-widget drag-out and host
 *  drops working. */
export function excludeRegionCollision(excludedRegionId: string): CollisionDetection {
  return (args) =>
    rectIntersection({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.[SF_REGION_KEY] !== excludedRegionId,
      ),
    });
}
