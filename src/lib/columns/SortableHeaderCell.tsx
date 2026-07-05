/** Column-reorder drag wiring shared by DataTable and Explorer header cells
 *  (issue #28): a render-prop wrapper over dnd-kit's `useSortable`, so a
 *  header cell can be both a grid cell and a sortable item without owning
 *  any dnd-kit plumbing itself. */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";

/** Drag wiring handed to a header cell. Supplied by {@link SortableHeaderCell},
 *  omitted for static headers. */
export interface HeaderDnd {
  ref: (node: HTMLElement | null) => void;
  /** dnd-kit's a11y attributes (role/aria-roledescription/tabIndex) — spread
   *  onto the cell when it should double as the keyboard drag handle. */
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  style: CSSProperties;
  dragging: boolean;
}

export function SortableHeaderCell({
  id,
  render,
}: {
  id: string;
  render: (dnd: HeaderDnd) => ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
  });
  return render({
    ref: setNodeRef,
    attributes: attributes as unknown as Record<string, unknown>,
    listeners: listeners as Record<string, unknown> | undefined,
    style: { transform: CSS.Transform.toString(transform), transition },
    dragging: isDragging,
  });
}
