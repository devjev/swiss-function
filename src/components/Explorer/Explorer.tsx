import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { TreeChevron } from "../../lib/TreeChevron";
import { Menu } from "../Menu";
import type { FlatRow } from "./dnd";
import { findNode, flatten, wouldCycle } from "./dnd";
import styles from "./Explorer.module.css";
import { RenameField } from "./RenameField";
import type { ExplorerColumn, ExplorerNode, ExplorerProps } from "./types";
import { isFolder } from "./types";

const EMPTY_SET: ReadonlySet<string> = new Set();

type DropZone =
  | { kind: "into"; folderId: string }
  | { kind: "before"; flatIndex: number }
  | { kind: "after-all" };

// --- Default folder / file glyphs ------------------------------------------

function FolderGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <title>Folder</title>
      <path d="M1.5 4 H6 L7 5.25 H14.5 V13 H1.5 Z" fill="none" stroke="currentColor" />
    </svg>
  );
}

function FileGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <title>File</title>
      <path d="M3 1.5 H10 L13 4.5 V14.5 H3 Z" fill="none" stroke="currentColor" />
      <path d="M10 1.5 V4.5 H13" fill="none" stroke="currentColor" />
    </svg>
  );
}

// --- Helpers ----------------------------------------------------------------

function readCell<M>(col: ExplorerColumn<M>, node: ExplorerNode<M>): ReactNode {
  if (col.render) return col.render(node);
  const raw = col.accessor
    ? col.accessor(node)
    : (node.meta as Record<string, unknown> | undefined)?.[col.id];
  return raw == null ? "" : String(raw);
}

function buildGridTemplate<M>(columns: ExplorerColumn<M>[]): string {
  return columns
    .map((c) => (typeof c.width === "number" ? `${c.width}px` : (c.width ?? "minmax(0, 1fr)")))
    .join(" ");
}

// --- Main component --------------------------------------------------------

export function Explorer<M = unknown>(props: ExplorerProps<M>) {
  const {
    nodes,
    columns,
    selectedIds = EMPTY_SET as Set<string>,
    onSelectionChange,
    expandedIds = EMPTY_SET as Set<string>,
    onExpandedChange,
    editingId = null,
    onEditingChange,
    editable = false,
    onRename,
    onAdd,
    onMove,
    onDelete,
    icon,
    showHeader = true,
    rowHeight = 32,
    height = "100%",
    className,
    style,
    ...rest
  } = props;

  // Internal: keyboard cursor, range anchor, context menu, drag state.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; targetId: string | null } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  // --- Derived ------------------------------------------------------------
  const flatRows = useMemo(() => flatten(nodes, expandedIds), [nodes, expandedIds]);
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < flatRows.length; i++) {
      const r = flatRows[i];
      if (r) m.set(r.node.id, i);
    }
    return m;
  }, [flatRows]);
  const gridTemplate = useMemo(() => buildGridTemplate(columns), [columns]);

  // --- Virtualization -----------------------------------------------------
  const viewportRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  // --- State setters that always go through the controlled callbacks -----
  const setSelection = (ids: Set<string>) => onSelectionChange?.(ids);
  const setExpanded = (ids: Set<string>) => onExpandedChange?.(ids);
  const setEditing = (id: string | null) => onEditingChange?.(id);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  // --- Selection --------------------------------------------------------
  const handleRowPointerDown = (e: MouseEvent, row: FlatRow<M>) => {
    // Right-click is handled in onContextMenu; don't disturb selection here for it.
    if (e.button === 2) return;
    const id = row.node.id;
    if (e.shiftKey && anchorId) {
      const a = indexById.get(anchorId);
      const b = indexById.get(id);
      if (a != null && b != null) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const next = new Set<string>();
        for (let i = lo; i <= hi; i++) {
          const r = flatRows[i];
          if (r) next.add(r.node.id);
        }
        setSelection(next);
      }
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelection(next);
      setAnchorId(id);
    } else {
      setSelection(new Set([id]));
      setAnchorId(id);
    }
    setFocusedId(id);
  };

  const handleRowDoubleClick = (row: FlatRow<M>) => {
    if (!editable) return;
    setEditing(row.node.id);
  };

  const handleRowContextMenu = (e: MouseEvent, row: FlatRow<M>) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.has(row.node.id)) {
      setSelection(new Set([row.node.id]));
      setAnchorId(row.node.id);
    }
    setFocusedId(row.node.id);
    setCtx({ x: e.clientX, y: e.clientY, targetId: row.node.id });
  };

  const handleViewportContextMenu = (e: MouseEvent) => {
    if (!editable) return;
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY, targetId: null });
  };

  const handleViewportClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelection(new Set());
      setAnchorId(null);
      setFocusedId(null);
    }
  };

  // --- Keyboard -----------------------------------------------------------
  const handleKeyDown = (e: KeyboardEvent) => {
    if (editingId != null) return; // RenameField owns its keys
    if (flatRows.length === 0) return;

    // Cmd/Ctrl+A: select all visible
    if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setSelection(new Set(flatRows.map((r) => r.node.id)));
      return;
    }

    const idx = focusedId != null ? indexById.get(focusedId) : undefined;
    const cur = idx != null ? flatRows[idx] : null;

    const moveFocus = (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(nextIdx, flatRows.length - 1));
      const target = flatRows[clamped];
      if (!target) return;
      const id = target.node.id;
      setFocusedId(id);
      if (e.shiftKey && anchorId) {
        const a = indexById.get(anchorId);
        if (a != null) {
          const [lo, hi] = a <= clamped ? [a, clamped] : [clamped, a];
          const next = new Set<string>();
          for (let i = lo; i <= hi; i++) {
            const r = flatRows[i];
            if (r) next.add(r.node.id);
          }
          setSelection(next);
        }
      } else {
        setSelection(new Set([id]));
        setAnchorId(id);
      }
    };

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus((idx ?? -1) + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus((idx ?? flatRows.length) - 1);
    } else if (e.key === "ArrowLeft" && cur) {
      e.preventDefault();
      if (isFolder(cur.node) && expandedIds.has(cur.node.id)) {
        toggleExpand(cur.node.id);
      } else if (cur.parentId) {
        const parentIdx = indexById.get(cur.parentId);
        if (parentIdx != null) moveFocus(parentIdx);
      }
    } else if (e.key === "ArrowRight" && cur) {
      e.preventDefault();
      if (isFolder(cur.node)) {
        if (!expandedIds.has(cur.node.id)) {
          toggleExpand(cur.node.id);
        } else {
          const child = flatRows[(idx ?? -1) + 1];
          if (child && child.parentId === cur.node.id) moveFocus((idx ?? -1) + 1);
        }
      }
    } else if ((e.key === "Enter" || e.key === "F2") && cur && editable) {
      e.preventDefault();
      setEditing(cur.node.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSelection(new Set());
      setAnchorId(null);
    } else if ((e.key === "Delete" || e.key === "Backspace") && editable && selectedIds.size > 0) {
      e.preventDefault();
      onDelete?.([...selectedIds]);
    }
  };

  // --- DnD ----------------------------------------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const computeDropZone = (e: DragMoveEvent | DragEndEvent): DropZone | null => {
    if (!draggingId) return null;
    if (!e.over) return { kind: "after-all" };

    const data = e.over.data.current as { rowIndex?: number } | undefined;
    const rowIdx = data?.rowIndex;
    if (rowIdx == null) return null;

    const overRect = e.over.rect;
    const activator = e.activatorEvent as PointerEvent | null;
    if (!activator) return null;
    const currentY = activator.clientY + e.delta.y;
    const yWithin = currentY - overRect.top;
    const q = rowHeight / 4;
    const targetRow = flatRows[rowIdx];
    if (!targetRow) return null;

    const draggedNode = findNode(nodes, draggingId);
    if (!draggedNode) return null;

    let zone: DropZone;
    if (yWithin < q) {
      zone = { kind: "before", flatIndex: rowIdx };
    } else if (yWithin > rowHeight - q) {
      zone = { kind: "before", flatIndex: rowIdx + 1 };
    } else if (isFolder(targetRow.node)) {
      zone = { kind: "into", folderId: targetRow.node.id };
    } else {
      zone = { kind: "before", flatIndex: rowIdx };
    }

    // Cycle prevention: compute prospective parent and reject if it's the
    // dragged node itself or any of its descendants.
    let prospectiveParent: string | null = null;
    if (zone.kind === "into") prospectiveParent = zone.folderId;
    else if (zone.kind === "before") {
      const tgt = flatRows[zone.flatIndex];
      prospectiveParent = tgt ? tgt.parentId : null;
    }
    if (wouldCycle(draggedNode, prospectiveParent)) return null;
    return zone;
  };

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));

  const onDragMove = (e: DragMoveEvent) => {
    if (!editable) return;
    setDropZone(computeDropZone(e));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const zone = computeDropZone(e);
    const id = draggingId;
    setDropZone(null);
    setDraggingId(null);
    if (!zone || !id) return;
    if (zone.kind === "into") onMove?.(id, zone.folderId, null);
    else if (zone.kind === "after-all") onMove?.(id, null, null);
    else {
      const tgt = flatRows[zone.flatIndex];
      if (!tgt) onMove?.(id, null, null);
      else onMove?.(id, tgt.parentId, tgt.node.id);
    }
  };

  const onDragCancel = () => {
    setDropZone(null);
    setDraggingId(null);
  };

  // --- Context menu derived ----------------------------------------------
  const ctxTargetRow = ctx?.targetId != null ? flatRows[indexById.get(ctx.targetId) ?? -1] : null;
  const ctxTargetIsFolder = ctxTargetRow ? isFolder(ctxTargetRow.node) : false;
  // "Add" is relative to where you'd want the new node placed:
  //   - right-click on folder        → add as child of that folder
  //   - right-click on file          → add as sibling (same parent)
  //   - right-click on empty space   → add to root
  const addParentId = ctxTargetRow
    ? ctxTargetIsFolder
      ? ctxTargetRow.node.id
      : ctxTargetRow.parentId
    : null;

  // --- Render -------------------------------------------------------------
  return (
    <div
      className={cx(styles.wrapper, className)}
      style={style as CSSProperties}
      data-explorer-root=""
      {...rest}
    >
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {showHeader ? (
          <div className={styles.headerRow} style={{ gridTemplateColumns: gridTemplate }}>
            {columns.map((col) => (
              <div key={col.id} className={styles.headerCell} data-align={col.align ?? "start"}>
                {col.header}
              </div>
            ))}
          </div>
        ) : null}

        <div
          ref={viewportRef}
          role="treegrid"
          aria-label="Explorer"
          className={styles.viewport}
          style={{ height: typeof height === "number" ? `${height}px` : height }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onContextMenu={handleViewportContextMenu}
          onClick={handleViewportClick}
        >
          <div className={styles.body} style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const row = flatRows[vRow.index];
              if (!row) return null;
              const id = row.node.id;
              const isLast = vRow.index === flatRows.length - 1;
              return (
                <ExplorerRow<M>
                  key={id}
                  row={row}
                  rowIndex={vRow.index}
                  top={vRow.start}
                  rowHeight={rowHeight}
                  columns={columns}
                  gridTemplate={gridTemplate}
                  isSelected={selectedIds.has(id)}
                  isFocused={focusedId === id}
                  isExpanded={expandedIds.has(id)}
                  isEditing={editingId === id}
                  isDragging={draggingId === id}
                  dropZone={dropZone}
                  isLastRow={isLast}
                  draggable={editable}
                  icon={icon}
                  onChevronToggle={() => toggleExpand(id)}
                  onPointerDown={(e) => handleRowPointerDown(e, row)}
                  onDoubleClick={() => handleRowDoubleClick(row)}
                  onContextMenu={(e) => handleRowContextMenu(e, row)}
                  onRenameCommit={(name) => {
                    onRename?.(id, name);
                    setEditing(null);
                  }}
                  onRenameCancel={() => setEditing(null)}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingId ? (
            <DragOverlayContent name={findNode(nodes, draggingId)?.name ?? ""} />
          ) : null}
        </DragOverlay>

        {editable ? (
          <ContextMenu
            ctx={ctx}
            onClose={() => setCtx(null)}
            hasTarget={ctx?.targetId != null}
            onNewFile={() => {
              onAdd?.(addParentId, "file");
              setCtx(null);
            }}
            onNewFolder={() => {
              onAdd?.(addParentId, "folder");
              setCtx(null);
            }}
            onRename={() => {
              if (ctx?.targetId) setEditing(ctx.targetId);
              setCtx(null);
            }}
            onDelete={() => {
              if (ctx?.targetId) onDelete?.([ctx.targetId]);
              setCtx(null);
            }}
          />
        ) : null}
      </DndContext>
    </div>
  );
}

// --- ExplorerRow (internal) -----------------------------------------------

interface ExplorerRowProps<M> {
  row: FlatRow<M>;
  rowIndex: number;
  top: number;
  rowHeight: number;
  columns: ExplorerColumn<M>[];
  gridTemplate: string;
  isSelected: boolean;
  isFocused: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  isDragging: boolean;
  isLastRow: boolean;
  dropZone: DropZone | null;
  draggable: boolean;
  icon?: (node: ExplorerNode<M>) => ReactNode;
  onChevronToggle: () => void;
  onPointerDown: (e: MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
  onRenameCommit: (next: string) => void;
  onRenameCancel: () => void;
}

function ExplorerRow<M>(props: ExplorerRowProps<M>) {
  const {
    row,
    rowIndex,
    top,
    rowHeight,
    columns,
    gridTemplate,
    isSelected,
    isFocused,
    isExpanded,
    isEditing,
    isDragging,
    isLastRow,
    dropZone,
    draggable,
    icon,
    onChevronToggle,
    onPointerDown,
    onDoubleClick,
    onContextMenu,
    onRenameCommit,
    onRenameCancel,
  } = props;

  const id = row.node.id;
  const folder = isFolder(row.node);

  const draggableHook = useDraggable({ id, disabled: !draggable || isEditing });
  const droppableHook = useDroppable({ id: `row-${id}`, data: { rowIndex } });

  const setRef = (el: HTMLDivElement | null) => {
    draggableHook.setNodeRef(el);
    droppableHook.setNodeRef(el);
  };

  // Drop indicator flags
  const dropIntoMe = dropZone?.kind === "into" && dropZone.folderId === id;
  const dropBeforeMe = dropZone?.kind === "before" && dropZone.flatIndex === rowIndex;
  const dropAfterMeIsLast =
    isLastRow && dropZone?.kind === "before" && dropZone.flatIndex === rowIndex + 1;
  const dropAfterAllAndLast = isLastRow && dropZone?.kind === "after-all";

  const rowStyle: CSSProperties = {
    top: `${top}px`,
    height: `${rowHeight}px`,
    gridTemplateColumns: gridTemplate,
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: rendering a treegrid row as a div, not a table tr
    <div
      ref={setRef}
      {...(draggable && !isEditing ? draggableHook.listeners : {})}
      {...(draggable && !isEditing ? draggableHook.attributes : {})}
      role="row"
      tabIndex={-1}
      aria-level={row.depth + 1}
      aria-selected={isSelected}
      aria-expanded={folder ? isExpanded : undefined}
      data-row-id={id}
      data-selected={isSelected}
      data-focused={isFocused}
      data-dragging={isDragging || undefined}
      data-drop-into={dropIntoMe || undefined}
      data-drop-before={dropBeforeMe || undefined}
      data-drop-after-last={dropAfterMeIsLast || dropAfterAllAndLast || undefined}
      className={styles.row}
      style={rowStyle}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {columns.map((col, colIdx) => {
        const isTreeCol = colIdx === 0;
        return (
          <div
            key={col.id}
            className={styles.cell}
            data-align={col.align ?? "start"}
            {...(isTreeCol ? { "data-tree": "" } : {})}
          >
            {isTreeCol ? (
              <TreeCellContent
                node={row.node}
                depth={row.depth}
                folder={folder}
                expanded={isExpanded}
                editing={isEditing}
                icon={icon}
                onChevronToggle={onChevronToggle}
                onRenameCommit={onRenameCommit}
                onRenameCancel={onRenameCancel}
              />
            ) : (
              <span className={styles.cellContent}>{readCell(col, row.node)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Tree cell content -----------------------------------------------------

interface TreeCellContentProps<M> {
  node: ExplorerNode<M>;
  depth: number;
  folder: boolean;
  expanded: boolean;
  editing: boolean;
  icon?: (node: ExplorerNode<M>) => ReactNode;
  onChevronToggle: () => void;
  onRenameCommit: (next: string) => void;
  onRenameCancel: () => void;
}

function TreeCellContent<M>({
  node,
  depth,
  folder,
  expanded,
  editing,
  icon,
  onChevronToggle,
  onRenameCommit,
  onRenameCancel,
}: TreeCellContentProps<M>) {
  const customIcon = icon?.(node);
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        // Each guide also doubles as the indent step (0.75u wide).
        // biome-ignore lint/suspicious/noArrayIndexKey: indent guides have no identity beyond position
        <span key={i} className={styles.indentGuide} data-indent-guide="" aria-hidden="true" />
      ))}
      <TreeChevron visible={folder} expanded={expanded} onToggle={onChevronToggle} />
      <span className={styles.icon}>
        {customIcon ?? (folder ? <FolderGlyph /> : <FileGlyph />)}
      </span>
      {editing ? (
        <RenameField initialValue={node.name} onCommit={onRenameCommit} onCancel={onRenameCancel} />
      ) : (
        <span className={styles.cellContent}>{node.name}</span>
      )}
    </>
  );
}

// --- Drag overlay ----------------------------------------------------------

function DragOverlayContent({ name }: { name: string }) {
  return (
    <div
      className={styles.dragOverlay}
      style={{
        padding: "0 calc(var(--sf-unit) / 2)",
        height: "32px",
        boxShadow: "var(--sf-elevation-3)",
        border: "1px solid var(--sf-color-border-subtle)",
      }}
    >
      {name}
    </div>
  );
}

// --- Context menu ---------------------------------------------------------

interface ContextMenuProps {
  ctx: { x: number; y: number; targetId: string | null } | null;
  hasTarget: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ContextMenu(props: ContextMenuProps) {
  const { ctx, hasTarget, onClose, onNewFile, onNewFolder, onRename, onDelete } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Programmatically open by focusing+clicking the trigger after position update.
  useEffect(() => {
    if (ctx && triggerRef.current) {
      // The Menu's open is controlled via the `open` prop on Root.
      // Nothing to do here — Root re-renders with open=true.
    }
  }, [ctx]);

  return (
    <Menu.Root open={ctx != null} onOpenChange={(open) => !open && onClose()}>
      <Menu.Trigger
        ref={triggerRef}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "fixed",
          left: ctx?.x ?? 0,
          top: ctx?.y ?? 0,
          width: 0,
          height: 0,
          padding: 0,
          margin: 0,
          border: 0,
          background: "transparent",
          pointerEvents: "none",
        }}
      />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start">
          <Menu.Popup>
            <Menu.Item onClick={onNewFile}>New file</Menu.Item>
            <Menu.Item onClick={onNewFolder}>New folder</Menu.Item>
            {hasTarget ? (
              <>
                <Menu.Separator />
                <Menu.Item onClick={onRename}>Rename</Menu.Item>
                <Menu.Item onClick={onDelete}>Delete</Menu.Item>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
