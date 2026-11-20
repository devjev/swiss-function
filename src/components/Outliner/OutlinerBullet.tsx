import type {
  ComponentProps,
  CSSProperties,
  InputEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { lazy, memo, Suspense, useMemo, useRef, useState } from "react";
import type ReactMarkdown from "react-markdown";
import { Glyph } from "../../lib/icons";
import { TreeChevron } from "../../lib/TreeChevron";
import { Checkbox } from "../Checkbox";
import { Check, X } from "../Icon";
import { BulletContent } from "./BulletContent";
import { CALLOUT_LABEL, matchBlockType, parseBlock, taskProgress } from "./blocks";
import { RowContext } from "./context";
import styles from "./Outliner.module.css";
import { OutlinerCustom, OutlinerEmbed, OutlinerImage, OutlinerTable } from "./OutlinerWidgets";
import { sourceOffsetAtPoint } from "./sourceOffset";
import type { Bullet, BulletId, OutlinerBlockType } from "./types";

// The board brings dnd-kit, so it loads with the first `{{kanban}}` block.
const OutlinerKanban = lazy(() => import("./OutlinerKanban"));

type Components = ComponentProps<typeof ReactMarkdown>["components"];

export interface OutlinerBulletProps {
  bullet: Bullet;
  /** Indent steps. */
  depth: number;
  /** The tree level (1-based), the position among the siblings (1-based) and
   *  their number, for assistive technology. */
  level: number;
  position: number;
  siblings: number;
  hasChildren: boolean;
  /** The number an ordered block shows; null for any other block. */
  ordinal: number | null;
  /** The zoomed block: shown as the outline's title, with no bullet. */
  isTitle: boolean;
  /** The view's root (the zoomed or the embedded block): it always shows its
   *  children and has no fold arrow. */
  fixedOpen: boolean;
  /** The block that holds the keyboard: the selection's focus, or the block
   *  being edited. */
  isActive: boolean;
  /** Part of the block selection (the focus row included). */
  isSelected: boolean;
  isEditing: boolean;
  /** Being dragged by its bullet (or a child of a block that is). */
  isDragging: boolean;
  /** When virtualized: the row's offset in the scrolled list, and its index. */
  top?: number;
  virtualIndex?: number;
  /** The one row a Tab into the outline lands on. */
  tabbable: boolean;
  readOnly?: boolean;
  /** Markdown component overrides, for wiki links and block references. */
  markdownComponents?: Components;
  /** The app's own block types, asked before the built-in ones. */
  blockTypes?: readonly OutlinerBlockType[];
  /** While a completion list is open for this block: its id, and the id of
   *  the highlighted option. */
  completionListId?: string;
  completionOptionId?: string;
  /** A click on the block. `offset` is the clicked position in the markdown
   *  source; null in read-only mode. */
  onEnter: (id: BulletId, offset: number | null) => void;
  /** A press on the row: the start of a Shift+click or a drag selection. */
  onRowMouseDown: (id: BulletId, event: MouseEvent<HTMLDivElement>) => void;
  onToggleCollapsed: (id: BulletId) => void;
  /** The task checkbox was ticked or unticked. */
  onTaskToggle: (id: BulletId, done: boolean) => void;
  onTextChange: (id: BulletId, text: string) => void;
  /** Every key pressed in the editor: the Outliner owns the rules, since most
   *  of them change the tree. */
  onEditorKeyDown: (id: BulletId, event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** A character about to be typed (after the keyboard layout and before the
   *  text changes): where brackets are paired. */
  onEditorBeforeInput: (id: BulletId, event: InputEvent<HTMLTextAreaElement>) => void;
  /** The caret moved. */
  onEditorSelect: (id: BulletId) => void;
  /** A click on the bullet (zoom), and a press on it (the start of a drag).
   *  With neither, the bullet is a plain mark. */
  onBulletClick?: (id: BulletId) => void;
  onBulletPointerDown?: (id: BulletId, event: PointerEvent<HTMLElement>) => void;
  registerRow: (id: BulletId, element: HTMLDivElement | null) => void;
  registerEditor: (id: BulletId, element: HTMLTextAreaElement | null) => void;
}

/** Keeps the focus where it is: a press on the fold arrow or the id button
 *  must not take the caret out of the block being edited. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

/**
 * One block row: fold arrow, bullet, then the text as rendered markdown or,
 * while the block is entered, as a textarea over its markdown source.
 */
export const OutlinerBullet = memo(function OutlinerBullet(props: OutlinerBulletProps) {
  const {
    bullet,
    depth,
    level,
    position,
    siblings,
    hasChildren,
    ordinal,
    isTitle,
    fixedOpen,
    isActive,
    isSelected,
    isEditing,
    isDragging,
    top,
    virtualIndex,
    tabbable,
    readOnly,
    markdownComponents,
    blockTypes,
    completionListId,
    completionOptionId,
    onEnter,
    onRowMouseDown,
    onToggleCollapsed,
    onTaskToggle,
    onTextChange,
    onEditorKeyDown,
    onEditorBeforeInput,
    onEditorSelect,
    onBulletClick,
    onBulletPointerDown,
    registerRow,
    registerEditor,
  } = props;

  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  // What the block is, read from its text: a list number and a task marker
  // show in front of the text, and some kinds show something else entirely.
  const info = useMemo(() => parseBlock(bullet.content), [bullet.content]);
  const { task } = info;
  const rowContext = useMemo(() => ({ id: bullet.id, task }), [bullet.id, task]);
  const progress = useMemo(() => taskProgress(bullet.children), [bullet.children]);
  const custom = useMemo(
    () => (blockTypes?.length ? matchBlockType(blockTypes, bullet.content) : null),
    [blockTypes, bullet.content],
  );

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(`((${bullet.id}))`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard permission denied or unsupported: nothing to report
    }
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isEditing || e.defaultPrevented) return;
    // A link, a wiki link or the task checkbox keeps its own click, and so
    // does a table, a board, an image or an embedded block in this row.
    const target = e.target as HTMLElement;
    if (target.closest('a, button, input, [role="checkbox"]')) return;
    const widget = target.closest("[data-widget]");
    if (widget && e.currentTarget.contains(widget)) return;
    const text = textRef.current;
    // A drag that selected rendered text is a selection, not an entry.
    const selection = text?.ownerDocument.defaultView?.getSelection();
    if (selection && !selection.isCollapsed && text?.contains(selection.anchorNode)) return;
    const offset = readOnly
      ? null
      : text
        ? info.bodyStart +
          sourceOffsetAtPoint(text, bullet.content.slice(info.bodyStart), e.clientX, e.clientY)
        : bullet.content.length;
    onEnter(bullet.id, offset);
  };

  const text = (
    <div ref={textRef} className={styles.text}>
      <RowContext value={rowContext}>
        <BulletContent content={info.body} components={markdownComponents} />
      </RowContext>
    </div>
  );
  let main: ReactNode;
  if (custom) {
    main = <OutlinerCustom type={custom.type} source={custom.source} block={bullet} />;
  } else
    switch (info.kind) {
      case "divider":
        main = <hr className={styles.divider} />;
        break;
      case "callout":
        main = (
          <div className={styles.callout} data-tone={info.tone}>
            <span className={styles.calloutLabel}>{CALLOUT_LABEL[info.tone ?? "note"]}</span>
            {text}
          </div>
        );
        break;
      case "property":
        main = (
          <div className={styles.property}>
            <span className={styles.key} title={info.key}>
              {info.key}
            </span>
            {text}
          </div>
        );
        break;
      case "table":
        main = <OutlinerTable rows={bullet.children} />;
        break;
      case "kanban":
        main = (
          <Suspense fallback={<span className={styles.hint}>Board</span>}>
            <OutlinerKanban columns={bullet.children} />
          </Suspense>
        );
        break;
      case "embed":
        main = <OutlinerEmbed id={info.ref ?? ""} host={bullet.id} />;
        break;
      case "image":
        main = info.image ? <OutlinerImage id={bullet.id} image={info.image} /> : text;
        break;
      default:
        main = text;
    }

  return (
    <div
      ref={(el) => registerRow(bullet.id, el)}
      role="treeitem"
      aria-level={level}
      aria-posinset={position}
      aria-setsize={siblings}
      aria-expanded={hasChildren ? fixedOpen || !bullet.collapsed : undefined}
      aria-selected={isSelected}
      className={styles.row}
      style={
        {
          "--sf-outliner-depth": depth,
          insetBlockStart: top,
        } as CSSProperties
      }
      tabIndex={tabbable && !isEditing ? 0 : -1}
      data-active={isActive || undefined}
      data-selected={isSelected || undefined}
      data-editing={isEditing || undefined}
      data-title={isTitle || undefined}
      data-dragging={isDragging || undefined}
      data-virtual={top !== undefined || undefined}
      data-index={virtualIndex}
      data-bullet-id={bullet.id}
      onClick={handleClick}
      onMouseDown={(e) => onRowMouseDown(bullet.id, e)}
    >
      <span className={styles.fold} onMouseDown={keepFocus}>
        <TreeChevron
          expanded={!bullet.collapsed}
          visible={hasChildren && !fixedOpen}
          onToggle={() => onToggleCollapsed(bullet.id)}
          tabIndex={-1}
        />
      </span>
      {isTitle ? (
        <span className={styles.bullet} aria-hidden="true" />
      ) : onBulletClick || onBulletPointerDown ? (
        <button
          type="button"
          className={styles.bullet}
          data-bullet-handle=""
          data-collapsed={(hasChildren && bullet.collapsed) || undefined}
          data-zoom={onBulletClick ? "" : undefined}
          data-drag={onBulletPointerDown ? "" : undefined}
          // A pointer affordance: the keys zoom (Mod+.) and move (Alt+Shift+Arrows).
          tabIndex={-1}
          aria-label={onBulletClick ? "Zoom in" : "Drag to move"}
          onMouseDown={keepFocus}
          onPointerDown={onBulletPointerDown && ((e) => onBulletPointerDown(bullet.id, e))}
          onClick={(e) => {
            e.stopPropagation();
            onBulletClick?.(bullet.id);
          }}
        >
          <span className={styles.dot} />
        </button>
      ) : (
        <span
          className={styles.bullet}
          data-collapsed={(hasChildren && bullet.collapsed) || undefined}
          aria-hidden="true"
        >
          <span className={styles.dot} />
        </span>
      )}
      <div
        className={styles.content}
        data-view={!isEditing || undefined}
        data-kind={info.kind === "text" ? undefined : info.kind}
        data-level={info.level}
        data-task={(!isEditing && task) || undefined}
      >
        {isEditing ? (
          <div className={styles.editor} data-value={bullet.content}>
            <textarea
              ref={(el) => registerEditor(bullet.id, el)}
              className={styles.textarea}
              aria-label="Block text"
              aria-autocomplete={completionListId ? "list" : undefined}
              aria-controls={completionListId}
              aria-activedescendant={completionOptionId}
              rows={1}
              value={bullet.content}
              onChange={(e) => onTextChange(bullet.id, e.target.value)}
              onKeyDown={(e) => onEditorKeyDown(bullet.id, e)}
              onBeforeInput={(e) => onEditorBeforeInput(bullet.id, e)}
              onSelect={() => onEditorSelect(bullet.id)}
            />
          </div>
        ) : (
          <>
            {(info.ordered || task) && (
              <span className={styles.lead} onMouseDown={keepFocus}>
                {info.ordered && <span className={styles.number}>{ordinal ?? 1}.</span>}
                {task === "cancelled" ? (
                  <button
                    type="button"
                    className={styles.cancelled}
                    // The outline is one tab stop; Mod+Enter is the key for this.
                    tabIndex={-1}
                    disabled={readOnly}
                    aria-label="Cancelled. Reopen"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskToggle(bullet.id, false);
                    }}
                  >
                    <Glyph slot="close" fallback={X} size="0.7em" />
                  </button>
                ) : (
                  task && (
                    <Checkbox
                      checked={task === "done"}
                      indeterminate={task === "doing"}
                      readOnly={readOnly}
                      // The outline is one tab stop; Mod+Enter is the key for this.
                      tabIndex={-1}
                      aria-label={task === "doing" ? "In progress" : "Done"}
                      onCheckedChange={(checked) => onTaskToggle(bullet.id, checked)}
                    />
                  )
                )}
              </span>
            )}
            <div className={styles.main}>{main}</div>
            {progress && (
              <span
                className={styles.progress}
                role="img"
                aria-label={`${progress.done} of ${progress.total} tasks done`}
              >
                {progress.done}/{progress.total}
              </span>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        className={styles.copyRefButton}
        // A pointer affordance: the outline is one tab stop.
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          void copyRef();
        }}
        onMouseDown={keepFocus}
        aria-label={`Copy block reference: ((${bullet.id}))`}
        title={copied ? "Copied" : `Copy ((${bullet.id}))`}
        data-copied={copied || undefined}
      >
        {copied ? <Glyph slot="check" fallback={Check} size="0.85em" /> : "id"}
      </button>
    </div>
  );
});
