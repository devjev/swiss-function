import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useEffect, useRef, useState } from "react";
import type ReactMarkdown from "react-markdown";
import { cx } from "../../lib/cx";
import { TreeChevron } from "../../lib/TreeChevron";
import { Markdown } from "../Markdown";
import { TextEdit } from "../TextEdit";
import { passthroughUrlTransform, preprocessOutlinerMarkdown } from "./markdown-extensions";
import styles from "./Outliner.module.css";
import type { Bullet } from "./types";

type Components = ComponentProps<typeof ReactMarkdown>["components"];

export interface OutlinerBulletProps {
  bullet: Bullet;
  depth: number;
  hasChildren: boolean;
  isActive: boolean;
  isEditing: boolean;
  readOnly?: boolean;
  /** Markdown component overrides — for wiki-links / block-refs. */
  markdownComponents?: Components;
  /** Click on the content area. */
  onActivate: () => void;
  /** Double-click → enter edit mode. */
  onStartEdit: () => void;
  /** Chevron click → toggle the collapsed flag. */
  onToggleCollapsed: () => void;
  /** Commit a content edit. */
  onCommit: (content: string) => void;
  /** Bail out of edit mode without writing. */
  onCancel: () => void;
  /** Cmd/Ctrl+Enter: commit current AND ask the Outliner to create the next bullet. */
  onCommitAndNew: (content: string) => void;
  /** Backspace at start of an empty bullet: delete + focus prev. */
  onDeleteIfEmpty: () => void;
  /** ↑ at first line in editor: commit + nav prev (Outliner handles re-focus). */
  onCommitAndPrev: (content: string) => void;
  /** ↓ at last line in editor: commit + nav next. */
  onCommitAndNext: (content: string) => void;
  /** Tab / Shift+Tab while editing: commit then indent/outdent. */
  onCommitAndIndent: (content: string) => void;
  onCommitAndOutdent: (content: string) => void;
}

/**
 * One bullet row. Owns its draft state when editing; bubbles structural intents
 * (commit-and-X, delete-if-empty) up to the Outliner for tree mutation.
 */
export const OutlinerBullet = forwardRef<HTMLDivElement, OutlinerBulletProps>(
  function OutlinerBullet(props, ref) {
    const {
      bullet,
      depth,
      hasChildren,
      isActive,
      isEditing,
      readOnly,
      markdownComponents,
      onActivate,
      onStartEdit,
      onToggleCollapsed,
      onCommit,
      onCancel,
      onCommitAndNew,
      onDeleteIfEmpty,
      onCommitAndPrev,
      onCommitAndNext,
      onCommitAndIndent,
      onCommitAndOutdent,
    } = props;

    const [draft, setDraft] = useState(bullet.content);
    const [copied, setCopied] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const copyRef = async () => {
      try {
        await navigator.clipboard.writeText(`((${bullet.id}))`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {
        // clipboard permission denied / unsupported — silently no-op
      }
    };

    // Sync draft when entering edit mode.
    useEffect(() => {
      if (isEditing) {
        setDraft(bullet.content);
      }
    }, [isEditing, bullet.content]);

    useEffect(() => {
      if (isEditing) {
        textareaRef.current?.focus();
        const len = textareaRef.current?.value.length ?? 0;
        textareaRef.current?.setSelectionRange(len, len);
      }
    }, [isEditing]);

    const handleEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Enter") {
        if (e.metaKey || e.ctrlKey) {
          // Ctrl/Cmd+Enter → insert literal newline at cursor.
          // (Browsers don't do this natively; we have to do it ourselves.)
          e.preventDefault();
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          ta.setRangeText("\n", start, end, "end");
          setDraft(ta.value);
        } else {
          // Plain Enter → commit + create new sibling bullet, edit it.
          e.preventDefault();
          onCommitAndNew(draft);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) onCommitAndOutdent(draft);
        else onCommitAndIndent(draft);
        return;
      }
      if (e.key === "Backspace" && ta.selectionStart === 0 && ta.selectionEnd === 0) {
        if (draft.trim() === "" && !hasChildren) {
          e.preventDefault();
          onDeleteIfEmpty();
          return;
        }
      }
      if (e.key === "ArrowUp" && ta.selectionStart === 0 && ta.selectionEnd === 0) {
        e.preventDefault();
        onCommitAndPrev(draft);
        return;
      }
      if (
        e.key === "ArrowDown" &&
        ta.selectionStart === ta.value.length &&
        ta.selectionEnd === ta.value.length
      ) {
        e.preventDefault();
        onCommitAndNext(draft);
        return;
      }
    };

    return (
      <div
        ref={ref}
        className={styles.row}
        style={{
          paddingInlineStart: `calc(var(--sf-unit) * ${depth} + var(--sf-unit) / 8)`,
        }}
        tabIndex={isActive && !isEditing ? 0 : -1}
        data-active={isActive || undefined}
        data-bullet-id={bullet.id}
        onClick={() => {
          if (!isEditing) onActivate();
        }}
      >
        <TreeChevron
          expanded={!bullet.collapsed}
          visible={hasChildren}
          onToggle={onToggleCollapsed}
        />
        <div
          className={cx(styles.content, isActive && !isEditing && styles.contentActive)}
          onDoubleClick={(e) => {
            if (readOnly) return;
            e.stopPropagation();
            onStartEdit();
          }}
        >
          {isEditing ? (
            <TextEdit
              ref={textareaRef}
              className={styles.bulletEditor}
              value={draft}
              rows={Math.max(1, draft.split("\n").length)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => onCommit(draft)}
              onKeyDown={handleEditorKey}
            />
          ) : (
            <BulletContent content={bullet.content} components={markdownComponents} />
          )}
        </div>
        <button
          type="button"
          className={styles.copyRefButton}
          onClick={(e) => {
            e.stopPropagation();
            void copyRef();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Copy block reference: ((${bullet.id}))`}
          title={copied ? "Copied!" : `Copy ((${bullet.id}))`}
          data-copied={copied || undefined}
        >
          {copied ? "✓" : "id"}
        </button>
      </div>
    );
  },
);

interface BulletContentProps {
  content: string;
  components?: Components;
}

function BulletContent({ content, components }: BulletContentProps): ReactNode {
  if (content.trim() === "") {
    return <span style={{ color: "var(--sf-color-muted)" }}>—</span>;
  }
  return (
    <Markdown
      value={content}
      preprocess={preprocessOutlinerMarkdown}
      components={components}
      urlTransform={passthroughUrlTransform}
    />
  );
}
