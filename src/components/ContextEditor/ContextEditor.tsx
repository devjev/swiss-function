import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Eye, EyeOff, Lock, Trash } from "../Icon";
import { Pane } from "../Pane";
import {
  type AttentionFlag,
  type BlockSpan,
  blockSpans,
  flagFor,
  fmtTokens,
  sumTokens,
} from "./attention";
import styles from "./ContextEditor.module.css";

// dnd-kit is pulled in only when the list is reorderable (the default). Lazy so
// it lands in its own chunk and never weighs down a read-only ContextEditor.
const ContextEditorRows = lazy(() => import("./ContextEditorRows"));

/** The known kinds of context. `kind` also accepts any other string. */
export type ContextBlockKind =
  | "system"
  | "developer"
  | "memory"
  | "document"
  | "tool"
  | "message"
  | (string & {});

export interface ContextBlock {
  /** Stable identity; used as the React key and the drag id. */
  id: string;
  /** What sort of context this is. Drives the short type tag. */
  kind: ContextBlockKind;
  /** Short label shown in the row. */
  title: string;
  /** Secondary line: source, timestamp, role. */
  detail?: string;
  /** Token cost of this block (you supply the count). */
  tokens: number;
  /** Relevance to the current request, 0..1 (a retrieval / rerank score). Omit
   *  and attention is positional only. */
  salience?: number;
  /** Held in context regardless of edits; resists exclude and remove. */
  pinned?: boolean;
  /** Whether the block is packed into the context. Defaults to included; set
   *  `false` to keep it in the list but out of the window. */
  enabled?: boolean;
}

export interface ContextEditorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** The context blocks, in send order (controlled). Pass with `onChange`. */
  value?: ContextBlock[];
  /** Initial blocks (uncontrolled). */
  defaultValue?: ContextBlock[];
  /** Called with the next blocks after any edit (reorder, exclude, remove). */
  onChange?: (blocks: ContextBlock[]) => void;
  /** The model's context window, in tokens. Default 128000. */
  contextWindow?: number;
  /** Tokens past which attention degrades ("lost in the middle"); drawn as a
   *  dashed cutoff on the gauge. Default is half the window. */
  effectiveContext?: number;
  /** Show the context without editing controls (no reorder / exclude / remove). */
  readOnly?: boolean;
  /** Short uppercase tag for a kind. Default maps the known kinds
   *  (system → SYS, …) and falls back to the first four letters. */
  kindLabel?: (kind: string) => string;
}

const DEFAULT_KIND_LABEL: Record<string, string> = {
  system: "SYS",
  developer: "DEV",
  memory: "MEM",
  document: "DOC",
  tool: "TOOL",
  message: "MSG",
};

const toneClass: Record<NonNullable<AttentionFlag>, string | undefined> = {
  strong: styles.toneStrong,
  buried: styles.toneBuried,
  wasted: styles.toneWasted,
};

const flagWord: Record<NonNullable<AttentionFlag>, string> = {
  strong: "strong",
  buried: "buried",
  wasted: "wasted",
};

const v = (o: Record<string, number | string>) => o as CSSProperties;

export const ContextEditor = forwardRef<HTMLDivElement, ContextEditorProps>(function ContextEditor(
  {
    value,
    defaultValue,
    onChange,
    contextWindow = 128_000,
    effectiveContext,
    readOnly = false,
    kindLabel,
    className,
    ...rest
  },
  ref,
) {
  const [internal, setInternal] = useState<ContextBlock[]>(defaultValue ?? []);
  const isControlled = value !== undefined;
  const blocks = isControlled ? value : internal;
  const setBlocks = (next: ContextBlock[]) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const [hovered, setHovered] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusAfterRemove = useRef<string | null>(null);

  // A pinned block is held in context regardless of `enabled`.
  const active = useMemo(() => blocks.filter((b) => b.pinned || b.enabled !== false), [blocks]);
  const spans = useMemo(() => blockSpans(active), [active]);
  const spanById = useMemo(() => new Map(spans.map((s) => [s.block.id, s] as const)), [spans]);
  const used = sumTokens(active);
  const pct = contextWindow > 0 ? Math.round((used / contextWindow) * 100) : 0;
  const cutoff = effectiveContext ?? contextWindow / 2;

  const label = (kind: string) =>
    kindLabel?.(kind) ?? DEFAULT_KIND_LABEL[kind] ?? kind.slice(0, 4).toUpperCase();

  const toggle = (id: string) =>
    setBlocks(
      blocks.map((b) => (b.id === id && !b.pinned ? { ...b, enabled: b.enabled === false } : b)),
    );
  const remove = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const next = blocks.filter((b) => b.id !== id || b.pinned);
    // After the removed row unmounts, move focus to a neighbouring remove button
    // rather than dropping it to the document body.
    focusAfterRemove.current = (next[idx] ?? next[idx - 1])?.id ?? null;
    setBlocks(next);
  };

  // Re-home focus after a removal (see `remove`).
  useLayoutEffect(() => {
    const id = focusAfterRemove.current;
    if (!id) return;
    focusAfterRemove.current = null;
    rootRef.current?.querySelector<HTMLElement>(`[data-remove-id="${CSS.escape(id)}"]`)?.focus();
  }, [blocks]);

  const cells = (block: ContextBlock, handle: ReactNode) => {
    const span = spanById.get(block.id);
    const flag = span ? flagFor(span) : null;
    const disabled = block.enabled === false && !block.pinned;
    // The flag and effective-% are otherwise colour-and-hover only; expose them
    // as text for screen readers and as a hover tooltip.
    const attnText = disabled
      ? "excluded from context"
      : `attention ${Math.round((span?.effective ?? 0) * 100)}%${flag ? `, ${flag}` : ""}`;
    return (
      <>
        {handle}
        <span className={styles.kindTag}>{label(block.kind)}</span>
        <div className={styles.rowMain}>
          <div className={styles.rowTitle}>{block.title}</div>
          {block.detail && <div className={styles.rowDetail}>{block.detail}</div>}
        </div>
        <span className={styles.rowTokens}>{fmtTokens(block.tokens)}</span>
        <div className={styles.meter} title={attnText}>
          {!disabled && span && (
            <div
              className={cx(styles.meterFill, flag && toneClass[flag])}
              style={v({ "--attn": span.effective })}
            />
          )}
          <span className={styles.srOnly}>{attnText}</span>
        </div>
        {!readOnly && (
          <div className={styles.actions}>
            {block.pinned ? (
              <span className={styles.pinIcon} title="Pinned in context">
                <Lock size={1} label="Pinned" />
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => toggle(block.id)}
                  aria-label={disabled ? `Include ${block.title}` : `Exclude ${block.title}`}
                  title={disabled ? "Include in context" : "Exclude from context"}
                >
                  {disabled ? <EyeOff size={1} /> : <Eye size={1} />}
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  data-remove-id={block.id}
                  onClick={() => remove(block.id)}
                  aria-label={`Remove ${block.title}`}
                  title="Remove"
                >
                  <Trash size={1} />
                </button>
              </>
            )}
          </div>
        )}
      </>
    );
  };

  const clearHover = (e: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(null);
  };
  const staticRow = (block: ContextBlock, editable: boolean) => (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover/focus only cross-highlights the gauge; the actionable controls are real buttons
    <div
      key={block.id}
      className={editable ? cx(styles.row, styles.rowLive) : styles.row}
      data-hover={hovered === block.id || undefined}
      data-disabled={(block.enabled === false && !block.pinned) || undefined}
      onMouseEnter={() => setHovered(block.id)}
      onMouseLeave={() => setHovered(null)}
      onFocus={() => setHovered(block.id)}
      onBlur={clearHover}
    >
      {cells(block, editable ? <span className={styles.grip} aria-hidden="true" /> : null)}
    </div>
  );

  const setRoot = (node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div {...rest} ref={setRoot} className={cx(styles.root, className)}>
      <Pane className={styles.gaugeCol}>
        <Gauge
          spans={spans}
          used={used}
          hovered={hovered}
          onHover={setHovered}
          contextWindow={contextWindow}
          cutoff={cutoff}
          label={label}
        />
      </Pane>
      <Pane className={styles.listCol}>
        <Pane.Header className={styles.header}>
          <span className={styles.headerTitle}>Context</span>
          <span className={styles.headerMeta}>
            <b>{fmtTokens(used)}</b> / {fmtTokens(contextWindow)} · {pct}%
          </span>
        </Pane.Header>
        <Pane.Body className={styles.list}>
          {readOnly ? (
            blocks.map((b) => staticRow(b, false))
          ) : (
            <Suspense fallback={blocks.map((b) => staticRow(b, true))}>
              <ContextEditorRows
                blocks={blocks}
                onReorder={setBlocks}
                rowClassName={cx(styles.row, styles.rowLive)}
                handleClassName={styles.gripButton}
                hovered={hovered}
                onHover={setHovered}
                renderCells={cells}
              />
            </Suspense>
          )}
        </Pane.Body>
      </Pane>
    </div>
  );
});

function Gauge({
  spans,
  used,
  hovered,
  onHover,
  contextWindow,
  cutoff,
  label,
}: {
  spans: BlockSpan[];
  used: number;
  hovered: string | null;
  onHover: (id: string | null) => void;
  contextWindow: number;
  cutoff: number;
  label: (kind: string) => string;
}) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const free = Math.max(0, contextWindow - used);
  const over = Math.max(0, used - contextWindow);
  const pastCutoff = Math.max(0, used - cutoff);
  const cutoffFrac = contextWindow > 0 ? cutoff / contextWindow : 0.5;
  const hoveredSpan = spans.find((s) => s.block.id === hovered) ?? null;
  const hoveredFlag = hoveredSpan ? flagFor(hoveredSpan) : null;

  return (
    <>
      <Pane.Header className={styles.header}>
        <span className={styles.headerTitle}>Budget</span>
        <span className={styles.headerMeta}>{fmtTokens(used)} used</span>
      </Pane.Header>
      <Pane.Body className={styles.gaugeBody}>
        <div className={styles.gaugeAxis}>
          {ticks.map((t) => (
            <span key={t} className={styles.gaugeTick} style={v({ "--at": `${t * 100}%` })}>
              {fmtTokens(t * contextWindow)}
            </span>
          ))}
        </div>
        <div
          className={styles.gaugeTrack}
          data-hovering={hovered ? "" : undefined}
          data-over={over > 0 ? "" : undefined}
        >
          <div
            className={styles.gaugeFree}
            style={v({ "--free": contextWindow > 0 ? free / contextWindow : 0 })}
          />
          {spans.map((s) => {
            const flag = flagFor(s);
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: segment hover only cross-highlights the matching row; no behaviour is gated on it
              <div
                key={s.block.id}
                className={cx(
                  styles.gaugeSeg,
                  flag && styles.gaugeSegFlag,
                  flag && toneClass[flag],
                )}
                style={v({
                  "--start": contextWindow > 0 ? (s.start * used) / contextWindow : 0,
                  "--frac": contextWindow > 0 ? s.block.tokens / contextWindow : 0,
                })}
                data-hover={hovered === s.block.id || undefined}
                onMouseEnter={() => onHover(s.block.id)}
                onMouseLeave={() => onHover(null)}
              >
                <div className={styles.gaugeSegDither} style={v({ "--attn": s.positional })} />
              </div>
            );
          })}
          <div className={styles.gaugeCapZone} />
          <div className={styles.gaugeCutoff} style={v({ "--at": `${cutoffFrac * 100}%` })} />
          <span className={styles.gaugeCutoffTag} style={v({ "--at": `${cutoffFrac * 100}%` })}>
            eff.
          </span>
        </div>
      </Pane.Body>
      <div className={styles.gaugeReadout}>
        {hoveredSpan ? (
          <>
            <span className={styles.readoutTitle}>
              <span className={styles.kindTag}>{label(hoveredSpan.block.kind)}</span>{" "}
              {hoveredSpan.block.title}
            </span>
            <span>
              <b>{fmtTokens(hoveredSpan.block.tokens)}</b>
              {" · "}
              <span className={hoveredFlag === "wasted" ? styles.readoutBad : undefined}>
                {Math.round(hoveredSpan.effective * 100)}%
                {hoveredFlag ? ` ${flagWord[hoveredFlag]}` : ""}
              </span>
            </span>
          </>
        ) : (
          <>
            <span>
              {over > 0 ? (
                <>
                  <b className={styles.readoutBad}>over by {fmtTokens(over)}</b>
                </>
              ) : (
                <>
                  <b>{fmtTokens(free)}</b> free
                </>
              )}
            </span>
            <span>
              {pastCutoff > 0 ? (
                <>
                  <b className={styles.readoutWarn}>{fmtTokens(pastCutoff)}</b> past cutoff
                </>
              ) : (
                "within effective ctx"
              )}
            </span>
          </>
        )}
      </div>
    </>
  );
}
