import type { ComponentProps, CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { memo, useRef, useState } from "react";
import type ReactMarkdown from "react-markdown";
import { Glyph } from "../../lib/icons";
import { TreeChevron } from "../../lib/TreeChevron";
import { Check } from "../Icon";
import { Markdown } from "../Markdown";
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
  /** A click on the block. `offset` is the clicked position in the markdown
   *  source; null in read-only mode. */
  onEnter: (id: BulletId, offset: number | null) => void;
  /** A press on the row: the start of a Shift+click or a drag selection. */
  onRowMouseDown: (id: BulletId, event: MouseEvent<HTMLDivElement>) => void;
  onToggleCollapsed: (id: BulletId) => void;
  onTextChange: (id: BulletId, text: string) => void;
  /** Every key pressed in the editor: the Outliner owns the rules, since most
   *  of them change the tree. */
  onEditorKeyDown: (id: BulletId, event: KeyboardEvent<HTMLTextAreaElement>) => void;
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
    onEnter,
    onRowMouseDown,
    onToggleCollapsed,
    onTextChange,
    onEditorKeyDown,
    registerRow,
    registerEditor,
  } = props;

  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
    // A link, a wiki link or a task checkbox keeps its own click.
    if ((e.target as HTMLElement).closest("a, button, input")) return;
    const content = contentRef.current;
    // A drag that selected rendered text is a selection, not an entry.
    const selection = content?.ownerDocument.defaultView?.getSelection();
    if (selection && !selection.isCollapsed && content?.contains(selection.anchorNode)) return;
    const offset =
      readOnly || !content
        ? null
        : sourceOffsetAtPoint(content, bullet.content, e.clientX, e.clientY);
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
      <div ref={contentRef} className={styles.content}>
        {isEditing ? (
          <div className={styles.editor} data-value={bullet.content}>
            <textarea
              ref={(el) => registerEditor(bullet.id, el)}
              className={styles.textarea}
              aria-label="Block text"
              rows={1}
              value={bullet.content}
              onChange={(e) => onTextChange(bullet.id, e.target.value)}
              onKeyDown={(e) => onEditorKeyDown(bullet.id, e)}
            />
          </div>
        ) : (
          <BulletContent content={bullet.content} components={markdownComponents} />
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
