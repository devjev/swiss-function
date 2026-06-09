import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, HTMLAttributes, MutableRefObject, ReactNode, RefObject } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Markdown } from "../Markdown";
import { type ProseBlock, parseBlocks } from "./blocks";
import styles from "./Prose.module.css";

interface ProseContextValue {
  blocks: ProseBlock[];
  headings: ProseBlock[];
  /** Map from block id → index in `blocks`. */
  indexById: Map<string, number>;
  bodyRef: RefObject<HTMLDivElement | null>;
  /** Active heading id (the topmost heading visible in the viewport). */
  activeHeadingId: string | null;
  setActiveHeadingId: (id: string | null) => void;
  /** Body installs its virtualizer's scrollToIndex here; Outline calls it. */
  scrollToIndexRef: MutableRefObject<((index: number) => void) | null>;
  /** Cap each block to the prose measure. */
  measured: boolean;
}

const ProseContext = createContext<ProseContextValue | null>(null);

function useProse(component: string): ProseContextValue {
  const ctx = useContext(ProseContext);
  if (!ctx) throw new Error(`${component} must be rendered inside <Prose.Root>`);
  return ctx;
}

export interface ProseRootProps extends HTMLAttributes<HTMLDivElement> {
  /** Markdown source. Required unless `blocks` is provided. */
  source?: string;
  /** Pre-split blocks (bypasses the built-in parser). */
  blocks?: ProseBlock[];
  /** Cap each block to `--sf-measure` for comfortable reading. Default `true`. */
  measured?: boolean;
  /** Compose a default 2-column layout (outline + body). When `false` (default),
   *  the consumer arranges Outline and Body themselves. */
  split?: boolean;
  children: ReactNode;
}

function Root({
  source,
  blocks: blocksProp,
  measured = true,
  split = false,
  className,
  children,
  ...rest
}: ProseRootProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollToIndexRef = useRef<((index: number) => void) | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);

  const { blocks, headings, indexById } = useMemo(() => {
    if (blocksProp) {
      return {
        blocks: blocksProp,
        headings: blocksProp.filter((b) => b.kind === "heading"),
        indexById: new Map(blocksProp.map((b, i) => [b.id, i])),
      };
    }
    const parsed = parseBlocks(source ?? "");
    return {
      blocks: parsed.blocks,
      headings: parsed.headings,
      indexById: new Map(parsed.blocks.map((b, i) => [b.id, i])),
    };
  }, [source, blocksProp]);

  const ctx = useMemo<ProseContextValue>(
    () => ({
      blocks,
      headings,
      indexById,
      bodyRef,
      activeHeadingId,
      setActiveHeadingId,
      scrollToIndexRef,
      measured,
    }),
    [blocks, headings, indexById, activeHeadingId, measured],
  );

  return (
    <ProseContext.Provider value={ctx}>
      <div {...rest} className={cx(styles.root, split && styles.split, className)}>
        {children}
      </div>
    </ProseContext.Provider>
  );
}

export interface ProseOutlineProps extends HTMLAttributes<HTMLElement> {
  /** Label for the navigation landmark. Default "Document outline". */
  ariaLabel?: string;
}

function Outline({ ariaLabel = "Document outline", className, ...rest }: ProseOutlineProps) {
  const { headings, activeHeadingId, indexById, scrollToIndexRef } = useProse("Prose.Outline");

  if (headings.length === 0) return null;

  return (
    <nav {...rest} aria-label={ariaLabel} className={cx(styles.outline, className)}>
      <ul className={styles.outlineList}>
        {headings.map((h) => {
          const isActive = h.id === activeHeadingId;
          return (
            <li
              key={h.id}
              className={cx(styles.outlineItem, isActive && styles.outlineItemActive)}
              style={{ "--sf-prose-outline-level": h.headingLevel } as CSSProperties}
            >
              <button
                type="button"
                className={styles.outlineLink}
                aria-current={isActive ? "location" : undefined}
                onClick={() => {
                  const index = indexById.get(h.id);
                  if (index !== undefined) scrollToIndexRef.current?.(index);
                }}
              >
                {h.headingText}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export interface ProseBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** Estimated block height in px — used until the real height is measured.
   *  Default `96`. Closer estimates reduce scroll jumps on first render. */
  estimateBlockSize?: number;
  /** Render extra blocks above/below the viewport. Default `6`. */
  overscan?: number;
}

function Body({ estimateBlockSize = 96, overscan = 6, className, ...rest }: ProseBodyProps) {
  const { blocks, bodyRef, scrollToIndexRef, measured, activeHeadingId, setActiveHeadingId } =
    useProse("Prose.Body");

  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => bodyRef.current,
    estimateSize: () => estimateBlockSize,
    overscan,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Expose imperative scrollToIndex to the rest of the tree (Outline).
  useEffect(() => {
    scrollToIndexRef.current = (index: number) =>
      virtualizer.scrollToIndex(index, { align: "start" });
    return () => {
      scrollToIndexRef.current = null;
    };
  }, [scrollToIndexRef, virtualizer]);

  // Active heading: the highest-indexed heading whose top is at or above
  // the scroll offset. We compute it from virtual items rather than using
  // IntersectionObserver because virtualized blocks mount/unmount.
  const virtualItems = virtualizer.getVirtualItems();
  const scrollOffset = virtualizer.scrollOffset ?? 0;
  let topHeading: string | null = null;
  for (const item of virtualItems) {
    if (item.start > scrollOffset + 1) break;
    const block = blocks[item.index];
    if (block?.kind === "heading") topHeading = block.id;
  }
  useEffect(() => {
    if (topHeading !== activeHeadingId) setActiveHeadingId(topHeading);
  }, [topHeading, activeHeadingId, setActiveHeadingId]);

  return (
    <div {...rest} ref={bodyRef} className={cx(styles.body, className)}>
      <div className={styles.blockList} style={{ blockSize: virtualizer.getTotalSize() }}>
        {virtualItems.map((item) => {
          const block = blocks[item.index];
          if (!block) return null;
          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              data-block-id={block.id}
              data-block-kind={block.kind}
              data-heading-level={block.headingLevel}
              id={block.kind === "heading" ? block.id : undefined}
              className={styles.block}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <Markdown value={block.source} measured={measured} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const Prose = Object.assign(Root, { Outline, Body });
