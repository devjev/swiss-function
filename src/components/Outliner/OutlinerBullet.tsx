import type {
  ComponentProps,
  CSSProperties,
  InputEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { memo, useRef, useState } from "react";
import type ReactMarkdown from "react-markdown";
import { Glyph } from "../../lib/icons";
import { TreeChevron } from "../../lib/TreeChevron";
import { Checkbox } from "../Checkbox";
import { Check } from "../Icon";
import { Markdown } from "../Markdown";
import { taskBody, taskState } from "./assist";
import { passthroughUrlTransform, preprocessOutlinerMarkdown } from "./markdown-extensions";
import styles from "./Outliner.module.css";
import { sourceOffsetAtPoint } from "./sourceOffset";
import type { Bullet, BulletId } from "./types";

type Components = ComponentProps<typeof ReactMarkdown>["components"];

export interface OutlinerBulletProps {
  bullet: Bullet;
  depth: number;
  hasChildren: boolean;
  /** The block that holds the keyboard: the selection's focus, or the block
   *  being edited. */
  isActive: boolean;
  /** Part of the block selection (the focus row included). */
  isSelected: boolean;
  isEditing: boolean;
  /** The one row a Tab into the outline lands on. */
  tabbable: boolean;
  readOnly?: boolean;
  /** Markdown component overrides, for wiki links and block references. */
  markdownComponents?: Components;
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
    hasChildren,
    isActive,
    isSelected,
    isEditing,
    tabbable,
    readOnly,
    markdownComponents,
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
    registerRow,
    registerEditor,
  } = props;

  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  // A block that starts with `[ ] ` or `[x] ` is a task: the marker shows as
  // a checkbox and the rest as the block's text.
  const task = taskState(bullet.content);
  const body = task ? taskBody(bullet.content) : bullet.content;

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
    // A link, a wiki link or the task checkbox keeps its own click.
    if ((e.target as HTMLElement).closest('a, button, input, [role="checkbox"]')) return;
    const text = textRef.current;
    // A drag that selected rendered text is a selection, not an entry.
    const selection = text?.ownerDocument.defaultView?.getSelection();
    if (selection && !selection.isCollapsed && text?.contains(selection.anchorNode)) return;
    const offset =
      readOnly || !text
        ? null
        : bullet.content.length -
          body.length +
          sourceOffsetAtPoint(text, body, e.clientX, e.clientY);
    onEnter(bullet.id, offset);
  };

  return (
    <div
      ref={(el) => registerRow(bullet.id, el)}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? !bullet.collapsed : undefined}
      aria-selected={isSelected}
      className={styles.row}
      style={{ "--sf-outliner-depth": depth } as CSSProperties}
      tabIndex={tabbable && !isEditing ? 0 : -1}
      data-active={isActive || undefined}
      data-selected={isSelected || undefined}
      data-editing={isEditing || undefined}
      data-bullet-id={bullet.id}
      onClick={handleClick}
      onMouseDown={(e) => onRowMouseDown(bullet.id, e)}
    >
      <span className={styles.fold} onMouseDown={keepFocus}>
        <TreeChevron
          expanded={!bullet.collapsed}
          visible={hasChildren}
          onToggle={() => onToggleCollapsed(bullet.id)}
          tabIndex={-1}
        />
      </span>
      <span
        className={styles.bullet}
        data-collapsed={(hasChildren && bullet.collapsed) || undefined}
        aria-hidden="true"
      >
        <span className={styles.dot} />
      </span>
      <div className={styles.content} data-task={(!isEditing && task) || undefined}>
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
            {task && (
              <span className={styles.task} onMouseDown={keepFocus}>
                <Checkbox
                  checked={task === "done"}
                  readOnly={readOnly}
                  // The outline is one tab stop; Mod+Enter is the key for this.
                  tabIndex={-1}
                  aria-label="Done"
                  onCheckedChange={(checked) => onTaskToggle(bullet.id, checked)}
                />
              </span>
            )}
            <div ref={textRef} className={styles.text}>
              <BulletContent content={body} components={markdownComponents} />
            </div>
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

interface BulletContentProps {
  content: string;
  components?: Components;
}

function BulletContent({ content, components }: BulletContentProps): ReactNode {
  // An empty block is an empty line: the bullet marks it.
  if (content.trim() === "") return <span className={styles.blank}>{"​"}</span>;
  return (
    <Markdown
      value={content}
      preprocess={preprocessOutlinerMarkdown}
      components={components}
      urlTransform={passthroughUrlTransform}
    />
  );
}
