// A board over a block's children: each child is a column, its children the
// cards. Dragging a card moves its block. In its own module so dnd-kit is
// lazy-loaded; owns its `DndContext`, or joins an `SfDndProvider` when one
// wraps it (see src/lib/dnd).

import type { CollisionDetection, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { closestCorners, DndContext, DragOverlay, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { useContext, useId, useMemo, useRef, useState } from "react";
import { SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd";
import { useSfSensors } from "../../lib/dnd/sensors";
import { prefersReducedMotion } from "../../lib/prefersReducedMotion";
import { BulletContent } from "./BulletContent";
import { parseBlock } from "./blocks";
import { ActionsContext } from "./context";
import { cardTarget } from "./kanban";
import styles from "./Outliner.module.css";
import type { Bullet, BulletId } from "./types";
import { plainLabel } from "./zoom";

interface CardData {
  blockId: BulletId;
  columnId: BulletId;
  column?: boolean;
}

export default function OutlinerKanban({ columns }: { columns: Bullet[] | undefined }) {
  const actions = useContext(ActionsContext);
  const shared = useSfDnd();
  const regionId = useId();
  const sensors = useSfSensors();
  const [dragged, setDragged] = useState<BulletId | null>(null);
  const live = useRef(columns ?? []);
  live.current = columns ?? [];

  // Only this board's cards and columns are places to drop.
  const collision = useMemo<CollisionDetection>(
    () => (args) =>
      closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => c.data.current?.[SF_REGION_KEY] === regionId,
        ),
      }),
    [regionId],
  );

  const start = (e: DragStartEvent) => {
    setDragged((e.active.data.current as CardData | undefined)?.blockId ?? null);
  };
  const end = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    const card = active.data.current as CardData | undefined;
    const target = over?.data.current as CardData | undefined;
    if (!card || !target) return;
    const place = cardTarget(live.current, card.blockId, {
      columnId: target.columnId,
      cardId: target.column ? null : target.blockId,
    });
    if (place) actions?.moveBlock(card.blockId, place.columnId, place.afterId);
  };

  const cardOf = (id: BulletId | null): Bullet | undefined => {
    for (const column of live.current) {
      const card = column.children?.find((c) => c.id === id);
      if (card) return card;
    }
    return undefined;
  };
  // The shared provider renders the overlay ahead of this component, so the
  // card is looked up through the ref.
  const renderOverlay = (activeId: string): ReactNode => {
    const card = cardOf(activeId.slice(regionId.length + 1));
    return card ? (
      <div className={styles.card} data-overlay="">
        {(actions ? actions.label(card.content) : plainLabel(card.content)) || "Empty block"}
      </div>
    ) : null;
  };

  useSfDndRegion(shared, {
    id: regionId,
    collisionDetection: collision,
    onDragStart: start,
    onDragEnd: end,
    onDragCancel: () => setDragged(null),
    renderOverlay,
  });

  if (!columns?.length) {
    return (
      <span className={styles.hint}>
        Board: add columns as child blocks, and cards as their children.
      </span>
    );
  }

  const board = (
    <div className={styles.board} data-widget="">
      {columns.map((column) => (
        <Column
          key={column.id}
          column={column}
          regionId={regionId}
          readOnly={actions?.readOnly ?? true}
          dragged={dragged}
        />
      ))}
    </div>
  );
  if (shared) return board;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => setDragged(null)}
    >
      {board}
      <DragOverlay dropAnimation={null}>
        {dragged ? renderOverlay(`${regionId}:${dragged}`) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  column,
  regionId,
  readOnly,
  dragged,
}: {
  column: Bullet;
  regionId: string;
  readOnly: boolean;
  dragged: BulletId | null;
}) {
  const actions = useContext(ActionsContext);
  const cards = column.children ?? [];
  const { setNodeRef, isOver } = useDroppable({
    id: `${regionId}:column:${column.id}`,
    data: { [SF_REGION_KEY]: regionId, blockId: column.id, columnId: column.id, column: true },
  });
  return (
    <section
      ref={setNodeRef}
      className={styles.column}
      data-over={(isOver && dragged !== null) || undefined}
      aria-label={plainLabel(column.content) || "Column"}
    >
      <header className={styles.columnHead}>
        <button
          type="button"
          className={styles.columnTitle}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => actions?.jumpTo(column.id)}
        >
          {(actions ? actions.label(column.content) : plainLabel(column.content)) || "Untitled"}
        </button>
        <span className={styles.count}>{cards.length}</span>
      </header>
      <SortableContext
        items={cards.map((c) => `${regionId}:${c.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            columnId={column.id}
            regionId={regionId}
            readOnly={readOnly}
          />
        ))}
      </SortableContext>
    </section>
  );
}

function Card({
  card,
  columnId,
  regionId,
  readOnly,
}: {
  card: Bullet;
  columnId: BulletId;
  regionId: string;
  readOnly: boolean;
}) {
  const actions = useContext(ActionsContext);
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: `${regionId}:${card.id}`,
    data: { [SF_REGION_KEY]: regionId, blockId: card.id, columnId },
    disabled: readOnly,
  });
  const info = parseBlock(card.content);
  return (
    // A pointer shortcut to the card's block, and its drag surface. The block
    // is reachable and movable with the keyboard in the outline below.
    <div
      ref={setNodeRef}
      className={styles.card}
      data-dragging={isDragging || undefined}
      data-task={info.task ?? undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        // dnd-kit's settle transition is an inline style, so it is gated
        // here; the reduced-motion media query cannot reach it.
        transition: prefersReducedMotion() ? undefined : transition,
      }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input")) return;
        actions?.jumpTo(card.id);
      }}
      {...listeners}
    >
      <BulletContent content={info.body} components={actions?.markdownComponents} />
    </div>
  );
}
