import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import { StackingProvider, useStackLayer, Z_LAYER } from "../../lib/stacking";
import { useCollapse } from "../../lib/useCollapse";
import { useFullscreen } from "../../lib/useFullscreen";
import { type DragDelta, usePointerDrag } from "../../lib/usePointerDrag";
import type { ButtonVariant } from "../Button";
import { Chat, type ChatAction, type ChatMessage, type ChatPart, type ChatProps } from "../Chat";
import { Collapse, Expand, X } from "../Icon";
import { type EffectName, NonIdealState } from "../NonIdealState";
import { SplitPane, type SplitSide, useSplitPane } from "../SplitPane";
import { Tabs } from "../Tabs";
import styles from "./ChatDrawer.module.css";

/** A single panel view: an icon in the header switcher plus its body content. */
export interface ChatDrawerView {
  /** Stable id — the active-view value. */
  id: string;
  /** Icon shown in the header switcher (the icon also IS the control). */
  icon: ReactNode;
  /** Accessible label for the icon button (used as its `aria-label`). */
  label: string;
  /** Panel body for this view. */
  content: ReactNode;
}

/** Where the centered column sits: on the centre axis, or flush left / right. */
export type ChatAlign = "center" | "left" | "right";

export interface ChatDrawerProps {
  /** The main app content — the chat panel pushes it aside (it doesn't overlay). */
  children?: ReactNode;
  /** Edge the panel sits on. Default `"right"`. */
  side?: SplitSide;
  /** Controlled open state. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional accessible title for the panel. */
  title?: ReactNode;

  /** Allow dragging the divider to resize the panel. Default `true`. */
  resizable?: boolean;
  /** Panel size in px (uncontrolled). Default 360. */
  defaultSize?: number;
  /** Min / max panel size in px. */
  minSize?: number;
  maxSize?: number;
  /** Fired with the new panel size (px) when a resize settles. */
  onSizeChange?: (size: number) => void;
  /** Controlled fullscreen state (the header's maximize toggle). Omit for
   *  uncontrolled. */
  expanded?: boolean;
  /** Initial fullscreen state when uncontrolled. Default `false`. */
  defaultExpanded?: boolean;
  /** Fired when the fullscreen state changes (the toggle, Escape). */
  onExpandedChange?: (expanded: boolean) => void;

  /** Center the panel body: the chat (or the active view) becomes a centered
   *  column of draggable width instead of filling the panel edge-to-edge. Drag
   *  either edge (or arrow-key it) and the opposite edge mirrors the move, so
   *  the column stays centered. Matters when the panel is wide (a large split,
   *  or fullscreen). Default `false`. */
  centered?: boolean;
  /** Where the centered column sits (only with `centered`): on the panel's
   *  centre axis (default), or flush against the left or right edge, the
   *  whole leftover width going to the one remaining margin. Aligned, the
   *  column has a single resize handle on its free edge and a drag moves that
   *  edge alone (no mirror); the margin on the aligned side is not rendered.
   *  Default `"center"`. */
  chatAlign?: ChatAlign;
  /** Centered-column width in px (uncontrolled; only with `centered`).
   *  Default 640. */
  defaultChatWidth?: number;
  /** Min / max centered-column width in px. The rendered column is also capped
   *  to the panel's content width. Default min 240. */
  minChatWidth?: number;
  maxChatWidth?: number;
  /** Fired with the new column width (px) when a centered resize settles or a
   *  keyboard step lands. */
  onChatWidthChange?: (width: number) => void;
  /** Populate the centered mode's side margins with app content: parked
   *  widgets, notes, anything the user set aside. Each side renders in the
   *  gutter beside the centered column and takes whatever width the column
   *  leaves. When the margins get narrower than `marginMinWidth`, their
   *  content hides (it stays mounted, so its state survives) and reappears
   *  once there is room again. Only rendered with `centered`. */
  margins?: { left?: ReactNode; right?: ReactNode };
  /** Hide the margin content when a margin is narrower than this (px).
   *  Default 160. */
  marginMinWidth?: number;

  /** Padding around the chat — the gutter the thinking effect fills.
   *  `number` → multiples of `--sf-unit` (default `1`); `string` → raw CSS. */
  padding?: number | string;

  /** While true, an animated effect blooms from the centre behind the chat. */
  thinking?: boolean;
  /** Fired when `thinking` goes false → true. */
  onThinkingStart?: () => void;
  /** Fired when `thinking` goes true → false. */
  onThinkingEnd?: () => void;

  /** Background effect while thinking. Default `"ripple"`. */
  effect?: EffectName;
  /** Effect colour (any CSS colour). Default `var(--sf-color-primary)`. */
  color?: string;
  /** Effect animation speed multiplier. Default `1`. */
  speed?: number;
  /** Grain of the effect: shade-block size in px (square). Smaller = finer
   *  dither. Defaults to `NonIdealState`'s cell size (7). */
  cellSize?: number;
  /** The always-on panel wash. A CSS colour overrides it; `false` disables it
   *  (idle panel stays plain). Omit for the default — a faint 7% tint of `color`. */
  wash?: string | false;

  /** Chat messages. Required unless `views` is provided. */
  messages?: ChatMessage[];
  /** Fired with the trimmed text when the user submits. Required unless `views` is provided. */
  onSubmit?: (text: string) => void;
  /** Fired when a user interacts with a choices / tree / custom block. */
  onAction?: (action: ChatAction) => void;
  /** Fired once when an error part appears in the transcript (log / toast /
   *  auto-retry). Forwarded to the inner `Chat`. */
  onError?: ChatProps["onError"];
  /** Render a custom part by `type`. */
  renderPart?: (part: ChatPart, ctx: { message: ChatMessage }) => ReactNode;
  /** Placeholder text for the built-in chat input. Default "Ask anything…". */
  placeholder?: string;
  /** Caption for the built-in chat's submit button. Default "Send". */
  sendLabel?: string;
  /** Visual variant of the built-in chat's submit button. Default "secondary". */
  sendVariant?: ButtonVariant;
  /** Override the built-in chat input's border colour (any CSS colour). */
  borderColor?: string;
  /** How the built-in chat reveals streaming assistant text. Forwarded to the
   *  inner `Chat`; pass `{ mode: "stream" }` for a live token stream, or `false`
   *  for plain Markdown. See `Chat`'s `reveal`. */
  reveal?: ChatProps["reveal"];
  /** Disable the input. Defaults to `thinking` (input locks while the agent works). */
  disabled?: boolean;

  /** Multi-view mode: the header becomes an icon bar with one icon per view,
   *  and the panel body shows the active view. Chat is just one view you supply.
   *  When set, `messages`/`onSubmit` are ignored — render your own `Chat` as a
   *  view's `content`. */
  views?: ChatDrawerView[];
  /** Controlled active view id (pairs with `onActiveViewChange`). */
  activeView?: string;
  /** Initial active view id (uncontrolled). Defaults to the first view. */
  defaultActiveView?: string;
  /** Fired with the new view id when the active view changes. */
  onActiveViewChange?: (id: string) => void;
  /** A bar in the header between the title (and view tabs) and the actions,
   *  taking the room in between: a transparent `MenuBar` with a `Search`, a
   *  toolbar. */
  menu?: ReactNode;
  /** Extra icon buttons placed in the header, before the fullscreen/close pair.
   *  Works in both default (chat) and `views` mode. */
  actions?: ReactNode;
}

/** Roughly matches `--sf-duration-slow`; used to unmount the effect after its
 *  collapse animation when thinking ends. */
const COLLAPSE_MS = 500;

/** Keyboard resize step for a centered-column edge (px). The opposite edge
 *  mirrors it, so one press changes the width by twice this. */
const EDGE_KEY_STEP = 24;

function toPadding(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

/** Window-chrome glyph size. `--sf-unit` is 24px, so 14px is off-grid; a raw
 *  length holds the chrome's established geometry exactly. */
const CHROME_ICON_SIZE = "14px";

/** Panel header: caption + optional view switcher on the left, custom actions
 *  and the fullscreen/close pair on the right. Rendered inside the SplitPane so
 *  the close button can drive its open state. */
function PanelHeader({
  title,
  views,
  menu,
  actions,
  expanded,
  onToggleFullscreen,
}: {
  title?: ReactNode;
  views?: ChatDrawerView[];
  menu?: ReactNode;
  actions?: ReactNode;
  expanded: boolean;
  onToggleFullscreen: () => void;
}) {
  const { setOpen } = useSplitPane();
  return (
    <div className={styles.header}>
      {title != null ? <h2 className={styles.title}>{title}</h2> : null}
      {views && views.length > 0 ? (
        <Tabs.List className={styles.viewTabs}>
          {views.map((view) => (
            <Tabs.Tab
              key={view.id}
              value={view.id}
              className={styles.viewTab}
              aria-label={view.label}
            >
              {view.icon}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      ) : null}
      {menu != null ? <div className={styles.menu}>{menu}</div> : null}
      <div className={styles.actions}>
        {actions}
        <button
          type="button"
          className={styles.iconButton}
          onClick={onToggleFullscreen}
          aria-label={expanded ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={expanded}
        >
          {expanded ? (
            <Glyph slot="collapse" fallback={Collapse} size={CHROME_ICON_SIZE} />
          ) : (
            <Glyph slot="expand" fallback={Expand} size={CHROME_ICON_SIZE} />
          )}
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <Glyph slot="close" fallback={X} size={CHROME_ICON_SIZE} />
        </button>
      </div>
    </div>
  );
}

/** A chat in a resizable side panel that **pushes** the main content aside (a
 *  split, not an overlay). While `thinking`, an animated `NonIdealState` effect
 *  blooms from the centre outward and fills the padding frame around the chat. */
export const ChatDrawer = forwardRef<HTMLDivElement, ChatDrawerProps>(function ChatDrawer(
  {
    children,
    side = "right",
    open,
    defaultOpen,
    onOpenChange,
    title,
    menu,
    resizable = true,
    defaultSize = 360,
    minSize,
    maxSize,
    onSizeChange,
    expanded: expandedProp,
    defaultExpanded,
    onExpandedChange,
    centered = false,
    chatAlign = "center",
    defaultChatWidth = 640,
    minChatWidth = 240,
    maxChatWidth,
    onChatWidthChange,
    margins,
    marginMinWidth = 160,
    padding = 1,
    thinking = false,
    onThinkingStart,
    onThinkingEnd,
    effect = "ripple",
    color = "var(--sf-color-primary)",
    speed = 1,
    cellSize,
    wash,
    messages,
    onSubmit,
    onAction,
    onError,
    renderPart,
    placeholder,
    sendLabel,
    sendVariant,
    borderColor,
    reveal,
    disabled,
    views,
    activeView,
    defaultActiveView,
    onActiveViewChange,
    actions,
  },
  ref,
) {
  // Bloom lifecycle. `visible` mounts the effect; `revealed` drives the
  // clip-path grow; `runKey` forces a fresh mount each time so the effect's
  // clock restarts at zero. `prev` detects the thinking transitions.
  const prev = useRef(thinking);
  const [visible, setVisible] = useState(thinking);
  const [revealed, setRevealed] = useState(thinking);
  const [runKey, setRunKey] = useState(0);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const was = prev.current;
    prev.current = thinking;
    if (thinking === was) return;

    if (thinking) {
      onThinkingStart?.();
      clearTimeout(unmountTimer.current);
      setRunKey((k) => k + 1);
      setVisible(true);
      // Two frames so the element mounts collapsed, then transitions open —
      // the reveal grows from the centre instead of snapping to full.
      requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    } else {
      onThinkingEnd?.();
      setRevealed(false);
      unmountTimer.current = setTimeout(() => setVisible(false), COLLAPSE_MS);
    }
  }, [thinking, onThinkingStart, onThinkingEnd]);

  useEffect(() => () => clearTimeout(unmountTimer.current), []);

  // Fullscreen: the panel pops out to a viewport overlay; Escape exits.
  const { expanded, toggle } = useFullscreen({
    expanded: expandedProp,
    defaultExpanded,
    onExpandedChange,
  });

  // Centered mode: the body column's width. Dragging an edge keeps that edge
  // under the pointer while the opposite edge mirrors the move, so the column
  // stays centered and the width changes by twice the pointer delta.
  const [chatWidth, setChatWidth] = useState(defaultChatWidth);
  const [edgeDragging, setEdgeDragging] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const startChatWidth = useRef(chatWidth);

  const clampChatWidth = useCallback(
    (raw: number) => {
      let max = maxChatWidth ?? Number.POSITIVE_INFINITY;
      const el = bodyRef.current;
      if (el) max = Math.min(max, el.clientWidth);
      return Math.max(minChatWidth, Math.min(max, raw));
    },
    [minChatWidth, maxChatWidth],
  );

  // Centered, the opposite edge mirrors the move, so the width changes by
  // twice the pointer delta; aligned to an edge, the one free edge moves alone.
  const mirror = chatAlign === "center" ? 2 : 1;
  const widthFromDelta = useCallback(
    (edge: "left" | "right", d: DragDelta) =>
      edge === "left"
        ? startChatWidth.current - mirror * d.dx
        : startChatWidth.current + mirror * d.dx,
    [mirror],
  );

  const edgeDragOptions = (edge: "left" | "right") => ({
    onStart: () => {
      // Re-clamp on pickup so a stale width (e.g. after the panel shrank)
      // doesn't jump when the first move lands.
      startChatWidth.current = clampChatWidth(chatWidth);
      setEdgeDragging(true);
    },
    onMove: (d: DragDelta) => setChatWidth(clampChatWidth(widthFromDelta(edge, d))),
    onEnd: (d: DragDelta) => {
      const final = clampChatWidth(widthFromDelta(edge, d));
      setChatWidth(final);
      setEdgeDragging(false);
      onChatWidthChange?.(final);
    },
  });
  const leftEdgeDrag = usePointerDrag(edgeDragOptions("left"));
  const rightEdgeDrag = usePointerDrag(edgeDragOptions("right"));

  const onEdgeKey = (edge: "left" | "right") => (e: KeyboardEvent<HTMLDivElement>) => {
    // The arrow moves the pressed edge outward/inward; the mirror doubles it.
    const grow = edge === "left" ? "ArrowLeft" : "ArrowRight";
    const shrink = edge === "left" ? "ArrowRight" : "ArrowLeft";
    let next: number;
    if (e.key === grow) next = chatWidth + mirror * EDGE_KEY_STEP;
    else if (e.key === shrink) next = chatWidth - mirror * EDGE_KEY_STEP;
    else return;
    e.preventDefault();
    const c = clampChatWidth(next);
    setChatWidth(c);
    onChatWidthChange?.(c);
  };

  const edgeHandle = (edge: "left" | "right") => (
    // biome-ignore lint/a11y/useSemanticElements: ARIA splitter pattern, a focusable, draggable resize separator (same as SplitPane's divider).
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize chat (${edge} edge)`}
      aria-valuenow={Math.round(chatWidth)}
      aria-valuemin={minChatWidth}
      aria-valuemax={maxChatWidth}
      tabIndex={0}
      className={styles.edgeHandle}
      onPointerDown={(edge === "left" ? leftEdgeDrag : rightEdgeDrag).onPointerDown}
      onKeyDown={onEdgeKey(edge)}
    />
  );

  // Margin content hides when the gutters get too narrow for it. Centered,
  // both gutters are equal by construction (the mirrored resize), so one
  // observer on the left container drives both; aligned to an edge there is
  // one gutter, on the other side. The observed container itself stays in the
  // grid (hiding only the inner content), or the observer would read 0 and
  // never un-collapse.
  const { ref: marginProbeRef, collapsed: marginsCollapsed } = useCollapse<HTMLDivElement>({
    collapseAt: `${marginMinWidth}px`,
  });
  const probeSide = chatAlign === "left" ? "right" : "left";

  const marginCell = (side: "left" | "right") => {
    const inner = side === "left" ? margins?.left : margins?.right;
    return (
      <div
        className={styles.margin}
        data-side={side}
        ref={side === probeSide ? marginProbeRef : undefined}
      >
        {inner != null ? (
          <div className={cx(styles.marginContent, marginsCollapsed && styles.marginHidden)}>
            {inner}
          </div>
        ) : null}
      </div>
    );
  };

  /** Wraps the panel body (the chat, or the view panels) as the centered,
   *  edge-resizable column, flanked by the app-populated margins. */
  const centeredBody = (inner: ReactNode) => (
    <div
      ref={bodyRef}
      className={styles.centerBody}
      data-align={chatAlign}
      data-dragging={edgeDragging || undefined}
      style={{ "--cd-chat-width": `${chatWidth}px` } as CSSProperties}
    >
      {chatAlign !== "left" && marginCell("left")}
      {chatAlign !== "left" && edgeHandle("left")}
      <div className={styles.centerColumn}>{inner}</div>
      {chatAlign !== "right" && edgeHandle("right")}
      {chatAlign !== "right" && marginCell("right")}
    </div>
  );

  const contentStyle: CSSProperties = { padding: toPadding(padding) };

  const viewPanels =
    views && views.length > 0
      ? views.map((view) => (
          <Tabs.Panel key={view.id} value={view.id} keepMounted className={styles.viewPanel}>
            {view.content}
          </Tabs.Panel>
        ))
      : null;

  const chat = (
    <Chat
      className={styles.chat}
      height="100%"
      messages={messages ?? []}
      onSubmit={onSubmit ?? (() => {})}
      onAction={onAction}
      onError={onError}
      renderPart={renderPart}
      placeholder={placeholder}
      sendLabel={sendLabel}
      sendVariant={sendVariant}
      borderColor={borderColor}
      reveal={reveal}
      disabled={disabled ?? thinking}
    />
  );

  // Cross-portal stacking (issue #82): while expanded the panel is a modal-band
  // overlay, so seed the band then (a MenuBar dropdown, a Picker or a Popover
  // opened inside it climbs above the panel instead of painting under it) and
  // climb above a host overlay when nested; at rest the panel pushes content
  // aside and is no overlay at all.
  const layer = useStackLayer(Z_LAYER.modal, true);

  // `--cd-effect-color` tints the default wash; `--cd-wash` (set only when the
  // consumer customizes it) overrides the whole wash colour, or disables it.
  const panelStyle = {
    "--cd-effect-color": color,
    ...(wash !== undefined && { "--cd-wash": wash === false ? "transparent" : wash }),
    // Override SplitPane's inline size so the fullscreen overlay (inset:0) fills
    // the viewport. SplitPane spreads our style after its own, so this wins.
    ...(expanded && { inlineSize: "auto", blockSize: "auto" }),
    ...(expanded && layer.zIndex != null && { zIndex: layer.zIndex }),
  } as CSSProperties;

  return (
    <SplitPane
      ref={ref}
      side={side}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      resizable={resizable}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      onSizeChange={onSizeChange}
    >
      <SplitPane.Main>{children}</SplitPane.Main>
      <SplitPane.Panel
        className={cx(styles.panel, expanded && styles.fullscreen)}
        style={panelStyle}
      >
        {/* Static full-pane wash — a faint flat tint of the effect colour that's
            always present (so the idle panel isn't stark white), behind everything. */}
        <div className={styles.wash} aria-hidden="true" />
        <div className={styles.bg} data-open={revealed || undefined} aria-hidden="true">
          {visible ? (
            <NonIdealState
              key={runKey}
              effect={effect}
              color={color}
              speed={speed}
              cellSize={cellSize}
              className={styles.fill}
            />
          ) : null}
        </div>
        <div className={styles.content} style={contentStyle}>
          <StackingProvider ceiling={expanded ? layer.ceiling : 0}>
            {views && views.length > 0 ? (
              <Tabs.Root
                className={styles.views}
                value={activeView}
                defaultValue={defaultActiveView ?? views[0]?.id}
                onValueChange={(value) => onActiveViewChange?.(value as string)}
              >
                <PanelHeader
                  title={title}
                  views={views}
                  menu={menu}
                  actions={actions}
                  expanded={expanded}
                  onToggleFullscreen={toggle}
                />
                {centered ? centeredBody(viewPanels) : viewPanels}
              </Tabs.Root>
            ) : (
              <>
                <PanelHeader
                  title={title}
                  menu={menu}
                  actions={actions}
                  expanded={expanded}
                  onToggleFullscreen={toggle}
                />
                {centered ? centeredBody(chat) : <div className={styles.chatWrap}>{chat}</div>}
              </>
            )}
          </StackingProvider>
        </div>
        {/* Recess overlay — casts the inset shadow over the whole panel. */}
        <div className={styles.recess} aria-hidden="true" />
      </SplitPane.Panel>
    </SplitPane>
  );
});
