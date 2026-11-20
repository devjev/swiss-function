// The blocks that show something other than their text: a table and an image
// here, a due-date chip inside the text, an embedded block. Each reads what it
// needs from the outline through context (see context.ts).

import type { MouseEvent, ReactNode } from "react";
import { Component, lazy, Suspense, useContext, useMemo, useRef, useState } from "react";
import { usePointerDrag } from "../../lib/usePointerDrag";
import { Chip } from "../Chip";
import { BulletContent } from "./BulletContent";
import { type BlockImage, imageSource, isoDate, type TableCell, tableRows } from "./blocks";
import { ActionsContext, EmbedContext, RowContext } from "./context";
import styles from "./Outliner.module.css";
import type { Bullet, BulletId, OutlinerBlockProps, OutlinerBlockType } from "./types";

const DuePicker = lazy(() => import("./DuePicker"));

/** A press inside a widget is the widget's: it neither moves the caret out of
 *  the block being edited nor enters the widget's own block. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

// ----------------------------------------------------------------------------
// Table: the block's children are the rows
// ----------------------------------------------------------------------------

export function OutlinerTable({ rows: children }: { rows: Bullet[] | undefined }) {
  const actions = useContext(ActionsContext);
  const rows = tableRows(children);
  const [header, ...body] = rows;
  if (!header) {
    return (
      <span className={styles.hint}>
        Table: add rows as child blocks. A row's text is its first cell, its children the others.
      </span>
    );
  }
  const columns = Math.max(...rows.map((row) => row.length));
  const cells = (row: TableCell[], Cell: "th" | "td") =>
    Array.from({ length: columns }, (_, column) => {
      const cell = row[column];
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: a table cell is its position
        <Cell key={column} scope={Cell === "th" ? "col" : undefined}>
          {cell && (
            // A pointer shortcut to the cell's block, which the keyboard reaches
            // in the outline below.
            <div
              className={styles.cell}
              onMouseDown={keepFocus}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a, button, input")) return;
                actions?.jumpTo(cell.id);
              }}
            >
              <BulletContent content={cell.content} components={actions?.markdownComponents} />
            </div>
          )}
        </Cell>
      );
    });
  return (
    <div className={styles.tableWrap} data-widget="">
      <table className={styles.table}>
        <thead>
          <tr>{cells(header, "th")}</tr>
        </thead>
        <tbody>
          {body.map((row) => (
            <tr key={row[0]?.id}>{cells(row, "td")}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Image: `![alt|width](url)` alone in a block
// ----------------------------------------------------------------------------

const MIN_IMAGE_PX = 40;

export function OutlinerImage({ id, image }: { id: BulletId; image: BlockImage }) {
  const actions = useContext(ActionsContext);
  const frame = useRef<HTMLSpanElement>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const startWidth = useRef(0);
  const widthAt = (dx: number) => {
    const max = frame.current?.parentElement?.clientWidth ?? Number.POSITIVE_INFINITY;
    return Math.round(Math.max(MIN_IMAGE_PX, Math.min(startWidth.current + dx, max)));
  };
  const drag = usePointerDrag({
    onStart: () => {
      startWidth.current = frame.current?.getBoundingClientRect().width ?? 0;
    },
    onMove: ({ dx }) => setDragWidth(widthAt(dx)),
    onEnd: ({ dx }) => {
      setDragWidth(null);
      if (dx !== 0) actions?.setContent(id, imageSource(image, widthAt(dx)));
    },
  });
  const width = dragWidth ?? image.width;
  return (
    <span
      ref={frame}
      className={styles.image}
      data-widget=""
      data-resizing={dragWidth !== null || undefined}
      style={width === null ? undefined : { inlineSize: width }}
    >
      <img src={image.url} alt={image.alt} draggable={false} />
      {!actions?.readOnly && (
        <span
          className={styles.imageGrip}
          role="separator"
          aria-orientation="vertical"
          aria-label="Image width"
          onMouseDown={keepFocus}
          onPointerDown={drag.onPointerDown}
        />
      )}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Embed: `{{embed ((id))}}`
// ----------------------------------------------------------------------------

export function OutlinerEmbed({ id, host }: { id: BulletId; host: BulletId }) {
  const render = useContext(EmbedContext);
  return (
    <div className={styles.embed} data-widget="">
      {render?.(id, host)}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Due date: `@2026-11-25` in a block's text
// ----------------------------------------------------------------------------

export function DueChip({ date }: { date: string }) {
  const actions = useContext(ActionsContext);
  const row = useContext(RowContext);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Late only while there is something left to do.
  const open = row?.task === "todo" || row?.task === "doing";
  const late = open && date < isoDate(new Date());
  const editable = actions && row && !actions.readOnly;
  return (
    <>
      <Chip
        size="sm"
        tone={late ? "danger" : "neutral"}
        className={styles.due}
        data-late={late || undefined}
        onMouseDown={keepFocus}
        onClick={
          editable
            ? (e) => {
                e.stopPropagation();
                setAnchor(e.currentTarget);
              }
            : undefined
        }
      >
        {date}
      </Chip>
      {anchor && editable && (
        <Suspense fallback={null}>
          <DuePicker
            anchor={anchor}
            value={date}
            onClose={() => setAnchor(null)}
            onPick={(next) => {
              setAnchor(null);
              actions.setDate(row.id, date, isoDate(next));
            }}
          />
        </Suspense>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// A block type the app registered (`blockTypes`)
// ----------------------------------------------------------------------------

/** What a registered type throws while rendering stays in its block. */
export class BlockBoundary extends Component<
  { name: string; source: string; children: ReactNode },
  { failed: string | null; source: string }
> {
  override state = { failed: null as string | null, source: this.props.source };

  static getDerivedStateFromError(error: unknown) {
    return { failed: error instanceof Error ? error.message : String(error) };
  }

  // A changed source is a new attempt.
  static getDerivedStateFromProps(
    props: { source: string },
    state: { failed: string | null; source: string },
  ) {
    return props.source === state.source ? null : { failed: null, source: props.source };
  }

  override render() {
    if (this.state.failed === null) return this.props.children;
    return (
      <span className={styles.blockRefMissing}>
        ⟨{this.props.name} failed: {this.state.failed}⟩
      </span>
    );
  }
}

export function OutlinerCustom({
  type,
  source,
  block,
}: {
  type: OutlinerBlockType;
  source: string;
  block: Bullet;
}) {
  const actions = useContext(ActionsContext);
  const id = block.id;
  const handlers = useMemo(
    () => ({
      setContent: (content: string) => actions?.typeContent(id, content),
      edit: (target: BulletId) => actions?.jumpTo(target),
    }),
    [actions, id],
  );
  const props: OutlinerBlockProps = {
    block,
    source,
    readOnly: actions?.readOnly ?? true,
    ...handlers,
  };
  return (
    <div className={styles.custom} data-widget="" data-block-type={type.name}>
      <BlockBoundary name={type.name} source={source}>
        {type.render(props)}
      </BlockBoundary>
    </div>
  );
}
