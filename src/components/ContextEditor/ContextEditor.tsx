import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, lazy, Suspense, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { useCollapse } from "../../lib/useCollapse";
import { ChevronDown, MoreHorizontal } from "../Icon";
import { Menu } from "../Menu";
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
  /** Held in context regardless of `enabled`. */
  pinned?: boolean;
  /** Whether the block is packed into the context. Defaults to included; set
   *  `false` to keep it in the list but out of the window (dimmed, struck). */
  enabled?: boolean;
}

/** A selectable model. Choosing it sets the gauge's window (and, if given,
 *  scale). */
export interface ContextModel {
  /** Stable id (the controlled `model` value). */
  id: string;
  /** Shown in the selector. */
  label: string;
  /** The model's context window, in tokens. */
  contextWindow: number;
  /** Gauge scale for this model; falls back to the `scale` prop. */
  scale?: "linear" | "log";
}

/** The rail's "lowest attention" marker: a line across the gauge, also the
 *  gradient's faded centre (the "lost in the middle" trough). */
export interface LowestAttention {
  /** Token count where attention bottoms out; positioned on the rail via the
   *  scale. Default `contextWindow / 2` (the token midpoint). */
  at?: number;
  /** The line's label. Default "lowest attention". */
  label?: string;
}

/** The three key colours of the gauge's positional-attention gradient. Any CSS
 *  colour; omit one to keep its default (a `--sf-color-primary` alpha ramp).
 *  The stops are symmetric about the lowest-attention line. */
export interface RailColors {
  /** Top and bottom of the rail: primacy + recency, the strongest attention. */
  edge?: string;
  /** Midway between each edge and the middle. */
  quarter?: string;
  /** The rail centre, on the effective-context line: the "lost in the middle" trough. */
  middle?: string;
}

export interface ContextEditorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** The context blocks, in send order (controlled). Pass with `onChange`. */
  value?: ContextBlock[];
  /** Initial blocks (uncontrolled). */
  defaultValue?: ContextBlock[];
  /** Called with the next blocks after a reorder. */
  onChange?: (blocks: ContextBlock[]) => void;
  /** The model's context window, in tokens. Default 128000. Overridden by the
   *  selected `models` entry when a model selector is shown. */
  contextWindow?: number;
  /** Models offered by a dropdown in the list header; selecting one sets the
   *  gauge's window (and scale). Omit to hide the selector. */
  models?: ContextModel[];
  /** Selected model id (controlled). Pair with `onModelChange`. */
  model?: string;
  /** Initial selected model id (uncontrolled); defaults to the first model. */
  defaultModel?: string;
  /** Called when the selected model changes. */
  onModelChange?: (id: string, model: ContextModel) => void;
  /** The "lowest attention" line + gradient trough. Default `contextWindow/2`. */
  lowestAttention?: LowestAttention;
  /** Gauge scale. `"linear"` (default) is proportional to tokens; `"log"` gives
   *  a small used fraction room to read against a very large window (spans three
   *  decades, `contextWindow / 1000` up to the cap). */
  scale?: "linear" | "log";
  /** Colours of the rail's positional-attention gradient (edge / quarter /
   *  middle). Omit to keep the default `--sf-color-primary` alpha ramp. */
  railColors?: RailColors;
  /** Show the context without the reorder grip (a static viewer). */
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

const v = (o: Record<string, number | string>) => o as CSSProperties;

type Scale = "linear" | "log";

/** Map a token count to its fraction down the gauge (0 = top/empty, 1 = cap).
 *  Linear is proportional; log spans three decades (`contextWindow / 1000` up to
 *  the cap) so a small used fraction still reads against a huge window. Values
 *  at or below the log floor pin to the top. */
function makePos(contextWindow: number, scale: Scale): (tokens: number) => number {
  if (scale === "log" && contextWindow > 0) {
    const floor = contextWindow / 1000;
    const lo = Math.log(floor);
    const span = Math.log(contextWindow) - lo;
    return (t) =>
      span <= 0 || t <= floor ? 0 : t >= contextWindow ? 1 : (Math.log(t) - lo) / span;
  }
  return (t) => (contextWindow > 0 ? Math.min(1, Math.max(0, t / contextWindow)) : 0);
}

/** Decade ticks (…, 10k, 100k, 1M) from the log floor up to the cap. */
function logTicks(contextWindow: number): number[] {
  const floor = contextWindow / 1000;
  const ticks: number[] = [];
  for (let t = 10 ** Math.floor(Math.log10(contextWindow)); t >= floor - 1e-6; t /= 10) {
    ticks.push(t);
  }
  return ticks;
}

export const ContextEditor = forwardRef<HTMLDivElement, ContextEditorProps>(function ContextEditor(
  {
    value,
    defaultValue,
    onChange,
    contextWindow = 128_000,
    models,
    model,
    defaultModel,
    onModelChange,
    lowestAttention,
    scale = "linear",
    railColors,
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

  // Model selector (optional). The chosen model overrides the window + scale.
  const isModelControlled = model !== undefined;
  const [internalModel, setInternalModel] = useState<string | undefined>(
    defaultModel ?? models?.[0]?.id,
  );
  const modelId = isModelControlled ? model : internalModel;
  const selectedModel = models?.find((m) => m.id === modelId);
  const selectModel = (m: ContextModel) => {
    if (!isModelControlled) setInternalModel(m.id);
    onModelChange?.(m.id, m);
  };
  const window_ = selectedModel?.contextWindow ?? contextWindow;
  const gaugeScale = selectedModel?.scale ?? scale;

  // Fold the header's legend + model selector into a ⋯ menu when the list
  // column is too narrow to show them inline (container-width based).
  const { ref: headerRef, collapsed: toolsCollapsed } = useCollapse<HTMLDivElement>({
    collapseAt: 24,
  });

  // A pinned block is held in context regardless of `enabled`.
  const active = useMemo(() => blocks.filter((b) => b.pinned || b.enabled !== false), [blocks]);
  const spans = useMemo(() => blockSpans(active), [active]);
  const spanById = useMemo(() => new Map(spans.map((s) => [s.block.id, s] as const)), [spans]);
  const used = sumTokens(active);

  const label = (kind: string) =>
    kindLabel?.(kind) ?? DEFAULT_KIND_LABEL[kind] ?? kind.slice(0, 4).toUpperCase();

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

  // Header tools (legend + model options), reused inline and inside the ⋯ menu.
  const legend = (
    <span className={styles.legend}>
      <span className={styles.legendItem}>
        <span className={cx(styles.legendDot, styles.toneStrong)} />
        strong
      </span>
      <span className={styles.legendItem}>
        <span className={cx(styles.legendDot, styles.toneBuried)} />
        buried
      </span>
      <span className={styles.legendItem}>
        <span className={cx(styles.legendDot, styles.toneWasted)} />
        wasted
      </span>
    </span>
  );
  const hasModels = !!models && models.length > 0;
  const modelItems = models?.map((m) => (
    <Menu.Item key={m.id} onClick={() => selectModel(m)}>
      <span className={styles.modelItem}>
        <span className={styles.modelLabel}>{m.label}</span>
        <span className={styles.modelWindow}>{fmtTokens(m.contextWindow)}</span>
      </span>
    </Menu.Item>
  ));

  return (
    <div {...rest} ref={setRoot} className={cx(styles.root, className)}>
      <Pane className={styles.gaugeCol}>
        <Gauge
          spans={spans}
          used={used}
          hovered={hovered}
          onHover={setHovered}
          contextWindow={window_}
          scale={gaugeScale}
          railColors={railColors}
          lowestAttention={lowestAttention}
          label={label}
        />
      </Pane>
      <Pane className={styles.listCol}>
        <Pane.Header className={styles.header} ref={headerRef}>
          <span className={styles.headerTitle}>Contents</span>
          {toolsCollapsed ? (
            <Menu.Root>
              <Menu.Trigger
                render={
                  <button
                    type="button"
                    className={styles.overflowBtn}
                    aria-label="Legend and model"
                  >
                    <MoreHorizontal size={1} />
                  </button>
                }
              />
              <Menu.Portal>
                <Menu.Positioner sideOffset={4} align="end">
                  <Menu.Popup>
                    {modelItems}
                    {hasModels && <Menu.Separator />}
                    <div className={styles.legendMenu}>{legend}</div>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ) : (
            <div className={styles.headerTools}>
              {legend}
              {hasModels && (
                <Menu.Root>
                  <Menu.Trigger
                    render={
                      <button type="button" className={styles.modelTrigger}>
                        {selectedModel?.label ?? "Model"}
                        <span className={styles.modelWindow}>{fmtTokens(window_)}</span>
                        <ChevronDown size={1} />
                      </button>
                    }
                  />
                  <Menu.Portal>
                    {/* Left-align the popup to the trigger and offset by the
                        popup+item inset so item text lines up with the trigger
                        label. */}
                    <Menu.Positioner sideOffset={4} align="start" alignOffset={-4}>
                      <Menu.Popup>{modelItems}</Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              )}
            </div>
          )}
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
  scale,
  railColors,
  lowestAttention,
  label,
}: {
  spans: BlockSpan[];
  used: number;
  hovered: string | null;
  onHover: (id: string | null) => void;
  contextWindow: number;
  scale: Scale;
  railColors?: RailColors;
  lowestAttention?: LowestAttention;
  label: (kind: string) => string;
}) {
  const pos = makePos(contextWindow, scale);
  const ticks =
    scale === "log"
      ? logTicks(contextWindow).map((value) => ({ value, at: pos(value) }))
      : [0, 0.25, 0.5, 0.75, 1].map((f) => ({ value: f * contextWindow, at: f }));
  const over = Math.max(0, used - contextWindow);
  // The lowest-attention line + gradient trough: a token count (default the
  // token midpoint) mapped onto the rail via the scale.
  const trough = pos(lowestAttention?.at ?? contextWindow / 2);
  const troughLabel = lowestAttention?.label ?? "lowest attention";
  // Danger buffer: the last tenth of the window by tokens. Token-based (not a
  // fixed slice of height) so on a log scale it stays a thin sliver at the cap
  // instead of a tall band that collides with the line.
  const dangerFrac = 1 - pos(0.9 * contextWindow);

  // The attention gradient: its faded centre (`--eff`) sits on the lowest-
  // attention line, with quarter stops halfway to each end. Colours come from
  // `railColors` when given, else the CSS defaults (a `--sf-color-primary` ramp).
  const railStyle: Record<string, number | string> = {
    "--eff": `${trough * 100}%`,
    "--q1": `${(trough / 2) * 100}%`,
    "--q2": `${(trough + (1 - trough) / 2) * 100}%`,
  };
  if (railColors?.edge) railStyle["--ce-edge"] = railColors.edge;
  if (railColors?.quarter) railStyle["--ce-quarter"] = railColors.quarter;
  if (railColors?.middle) railStyle["--ce-middle"] = railColors.middle;

  return (
    <>
      <Pane.Header className={styles.header}>
        <span className={styles.headerTitle}>
          Context window <span className={styles.headerScale}>({scale} tkns)</span>
        </span>
      </Pane.Header>
      <Pane.Body className={styles.gaugeBody}>
        <div className={styles.gaugeAxis}>
          {ticks.map((t) => (
            <span
              key={t.value}
              // The top/bottom ticks sit on the track's own border; a mark there
              // would run collinear with it and read as a detached stub.
              className={cx(
                styles.gaugeTick,
                (t.at <= 0.001 || t.at >= 0.999) && styles.gaugeTickEdge,
              )}
              style={v({ "--at": `${t.at * 100}%` })}
            >
              {fmtTokens(t.value)}
            </span>
          ))}
        </div>
        <div
          className={styles.gaugeTrack}
          style={v(railStyle)}
          data-hovering={hovered ? "" : undefined}
          data-over={over > 0 ? "" : undefined}
        >
          <div className={styles.gaugeFree} style={v({ "--free": 1 - pos(used) })} />
          {spans.map((s) => {
            const flag = flagFor(s);
            const start = pos(s.start * used);
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
                  "--start": start,
                  "--frac": Math.max(0, pos(s.end * used) - start),
                })}
                data-hover={hovered === s.block.id || undefined}
                onMouseEnter={() => onHover(s.block.id)}
                onMouseLeave={() => onHover(null)}
              >
                <div className={styles.gaugeSegDither} style={v({ "--attn": s.positional })} />
                <span className={styles.gaugeSegLabel}>{label(s.block.kind)}</span>
              </div>
            );
          })}
          <div className={styles.gaugeCapZone} style={v({ "--cap": dangerFrac })} />
          <div className={styles.gaugeCutoff} style={v({ "--at": `${trough * 100}%` })} />
          <span className={styles.gaugeCutoffTag} style={v({ "--at": `${trough * 100}%` })}>
            {troughLabel}
          </span>
        </div>
      </Pane.Body>
    </>
  );
}
