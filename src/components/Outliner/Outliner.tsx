import type { ComponentProps, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type ReactMarkdown from "react-markdown";
import { cx } from "../../lib/cx";
import { Markdown } from "../Markdown";
import {
  MAX_TRANSCLUSION_DEPTH,
  passthroughUrlTransform,
  preprocessOutlinerMarkdown,
} from "./markdown-extensions";
import styles from "./Outliner.module.css";
import { OutlinerBullet } from "./OutlinerBullet";
import {
  deleteBullet,
  flatVisible,
  getNextVisible,
  getPrevVisible,
  indent,
  insertAfter,
  moveDown,
  moveUp,
  outdent,
  setCollapsed,
  toggleCollapsed,
  updateContent,
} from "./tree";
import type { BulletId, OutlinerProps } from "./types";

type Components = ComponentProps<typeof ReactMarkdown>["components"];

function defaultGenerateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `b_${Math.random().toString(36).slice(2)}`;
}

export function Outliner(props: OutlinerProps) {
  const {
    value,
    onChange,
    readOnly = false,
    generateId = defaultGenerateId,
    onWikiLinkClick,
    resolveBlockRef,
    className,
    style,
  } = props;

  const [activeId, setActiveId] = useState<BulletId | null>(null);
  const [editingId, setEditingId] = useState<BulletId | null>(null);

  const flat = useMemo(() => flatVisible(value), [value]);

  // --- Managed focus on the active bullet (read mode) ---
  const rowRefs = useRef<Map<BulletId, HTMLDivElement>>(new Map());
  useEffect(() => {
    if (!activeId || editingId) return;
    rowRefs.current.get(activeId)?.focus({ preventScroll: false });
  }, [activeId, editingId]);

  // --- Markdown components for wiki-links + block-refs ---
  const markdownComponents = useMemo<Components>(
    () => buildOutlinerComponents({ onWikiLinkClick, resolveBlockRef, depth: 0 }),
    [onWikiLinkClick, resolveBlockRef],
  );

  // --- Per-bullet handler factory ---
  // Commit on blur — also clears active so we don't leave a stale outline
  // when the user clicks away from the outliner entirely.
  const handleCommit = useCallback(
    (id: BulletId, content: string) => {
      onChange(updateContent(value, id, content));
      setEditingId(null);
      setActiveId(null);
    },
    [value, onChange],
  );

  const handleCommitAndNew = useCallback(
    (id: BulletId, content: string) => {
      const newId = generateId();
      const withCommit = updateContent(value, id, content);
      const next = insertAfter(withCommit, id, { id: newId, content: "" });
      onChange(next);
      setActiveId(newId);
      setEditingId(newId);
    },
    [value, onChange, generateId],
  );

  const handleCommitAndIndent = useCallback(
    (id: BulletId, content: string) => {
      const withCommit = updateContent(value, id, content);
      onChange(indent(withCommit, id));
      // Keep this bullet active + editing through the operation.
      setActiveId(id);
      setEditingId(id);
    },
    [value, onChange],
  );

  const handleCommitAndOutdent = useCallback(
    (id: BulletId, content: string) => {
      const withCommit = updateContent(value, id, content);
      onChange(outdent(withCommit, id));
      setActiveId(id);
      setEditingId(id);
    },
    [value, onChange],
  );

  const handleCommitAndPrev = useCallback(
    (id: BulletId, content: string) => {
      const prev = getPrevVisible(value, id);
      // At the top with no previous bullet: no-op, stay in edit mode.
      // Half-exiting (setEditingId(null) without touching activeId) would
      // leave the bullet showing .contentActive read-mode outline.
      if (!prev) return;
      onChange(updateContent(value, id, content));
      setActiveId(prev);
      setEditingId(prev);
    },
    [value, onChange],
  );

  const handleCommitAndNext = useCallback(
    (id: BulletId, content: string) => {
      const next = getNextVisible(value, id);
      if (!next) return;
      onChange(updateContent(value, id, content));
      setActiveId(next);
      setEditingId(next);
    },
    [value, onChange],
  );

  const handleDeleteIfEmpty = useCallback(
    (id: BulletId) => {
      const prev = getPrevVisible(value, id);
      onChange(deleteBullet(value, id));
      // Always re-enter edit mode on the prev bullet (edit-by-default).
      setActiveId(prev);
      setEditingId(prev && !readOnly ? prev : null);
    },
    [value, onChange, readOnly],
  );

  // Esc explicitly drops out of the outliner entirely; blur (handleCommit)
  // does the same. Both clear active so there's no stale "outlined but inert"
  // bullet sitting around.
  const handleCancel = useCallback(() => {
    setEditingId(null);
    setActiveId(null);
  }, []);

  // Click on a bullet → activate AND enter edit mode (Roam-style).
  // In readOnly mode, just activate so keyboard nav still works.
  const handleActivate = useCallback(
    (id: BulletId) => {
      setActiveId(id);
      if (!readOnly) setEditingId(id);
    },
    [readOnly],
  );
  // Double-click and explicit edit-trigger funnel through the same path now.
  const handleStartEdit = handleActivate;
  const handleToggleCollapsed = useCallback(
    (id: BulletId) => onChange(toggleCollapsed(value, id)),
    [value, onChange],
  );

  // --- Read-mode keyboard router (container-level) ---
  const handleContainerKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (editingId || !activeId) return;
      const isMeta = e.metaKey || e.ctrlKey;

      switch (e.key) {
        case "ArrowUp": {
          if (isMeta && e.shiftKey) {
            e.preventDefault();
            onChange(moveUp(value, activeId));
          } else {
            const prev = getPrevVisible(value, activeId);
            if (prev) {
              e.preventDefault();
              setActiveId(prev);
            }
          }
          return;
        }
        case "ArrowDown": {
          if (isMeta && e.shiftKey) {
            e.preventDefault();
            onChange(moveDown(value, activeId));
          } else {
            const next = getNextVisible(value, activeId);
            if (next) {
              e.preventDefault();
              setActiveId(next);
            }
          }
          return;
        }
        case "ArrowLeft": {
          e.preventDefault();
          onChange(setCollapsed(value, activeId, true));
          return;
        }
        case "ArrowRight": {
          e.preventDefault();
          onChange(setCollapsed(value, activeId, false));
          return;
        }
        case "Tab": {
          if (readOnly) return;
          e.preventDefault();
          if (e.shiftKey) onChange(outdent(value, activeId));
          else onChange(indent(value, activeId));
          return;
        }
        case "Enter":
        case "F2": {
          if (readOnly) return;
          e.preventDefault();
          setEditingId(activeId);
          return;
        }
        case "Backspace": {
          if (readOnly) return;
          e.preventDefault();
          const prev = getPrevVisible(value, activeId);
          onChange(deleteBullet(value, activeId));
          setActiveId(prev);
          return;
        }
      }
    },
    [activeId, editingId, value, onChange, readOnly],
  );

  return (
    <div
      className={cx(styles.root, className)}
      style={style}
      onKeyDown={handleContainerKey}
      tabIndex={-1}
    >
      {flat.map(({ id, bullet, depth, hasChildren }) => (
        <OutlinerBullet
          key={id}
          ref={(el) => {
            if (el) rowRefs.current.set(id, el);
            else rowRefs.current.delete(id);
          }}
          bullet={bullet}
          depth={depth}
          hasChildren={hasChildren}
          isActive={activeId === id}
          isEditing={editingId === id}
          readOnly={readOnly}
          markdownComponents={markdownComponents}
          onActivate={() => handleActivate(id)}
          onStartEdit={() => handleStartEdit(id)}
          onToggleCollapsed={() => handleToggleCollapsed(id)}
          onCommit={(content) => handleCommit(id, content)}
          onCancel={handleCancel}
          onCommitAndNew={(content) => handleCommitAndNew(id, content)}
          onDeleteIfEmpty={() => handleDeleteIfEmpty(id)}
          onCommitAndPrev={(content) => handleCommitAndPrev(id, content)}
          onCommitAndNext={(content) => handleCommitAndNext(id, content)}
          onCommitAndIndent={(content) => handleCommitAndIndent(id, content)}
          onCommitAndOutdent={(content) => handleCommitAndOutdent(id, content)}
        />
      ))}
    </div>
  );
}

// --- Markdown components factory (recursive, depth-capped) ---

interface BuildComponentsOpts {
  onWikiLinkClick?: (name: string) => void;
  resolveBlockRef?: (id: string) => string | null;
  depth: number;
}

function buildOutlinerComponents(opts: BuildComponentsOpts): Components {
  return {
    a: ({ href, children }) => {
      if (typeof href === "string" && href.startsWith("wiki:")) {
        const name = decodeURIComponent(href.slice("wiki:".length));
        return (
          <button
            type="button"
            className={styles.wikiLink}
            onClick={(e) => {
              e.stopPropagation();
              opts.onWikiLinkClick?.(name);
            }}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    },
    code: ({ children, className }) => {
      const text = typeof children === "string" ? children : String(children ?? "");
      if (text.startsWith("block-ref:")) {
        const id = text.slice("block-ref:".length);
        if (opts.depth >= MAX_TRANSCLUSION_DEPTH) {
          return <span className={styles.blockRefMissing}>⟨transclusion depth limit⟩</span>;
        }
        const resolved = opts.resolveBlockRef?.(id);
        if (resolved == null) {
          return <span className={styles.blockRefMissing}>⟨ref not found: {id}⟩</span>;
        }
        return (
          <span className={styles.blockRef}>
            <Markdown
              value={resolved}
              preprocess={preprocessOutlinerMarkdown}
              components={buildOutlinerComponents({ ...opts, depth: opts.depth + 1 })}
              urlTransform={passthroughUrlTransform}
              inline
            />
          </span>
        );
      }
      return <code className={className}>{children}</code>;
    },
  };
}
