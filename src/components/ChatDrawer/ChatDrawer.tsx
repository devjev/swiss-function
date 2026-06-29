import type { CSSProperties, ReactNode } from "react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { useFullscreen } from "../../lib/useFullscreen";
import type { ButtonVariant } from "../Button";
import { Chat, type ChatAction, type ChatMessage, type ChatPart } from "../Chat";
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
  /** The always-on panel wash. A CSS colour overrides it; `false` disables it
   *  (idle panel stays plain). Omit for the default — a faint 7% tint of `color`. */
  wash?: string | false;

  /** Chat messages. Required unless `views` is provided. */
  messages?: ChatMessage[];
  /** Fired with the trimmed text when the user submits. Required unless `views` is provided. */
  onSubmit?: (text: string) => void;
  /** Fired when a user interacts with a choices / tree / custom block. */
  onAction?: (action: ChatAction) => void;
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
  /** Extra icon buttons placed in the header, before the fullscreen/close pair.
   *  Works in both default (chat) and `views` mode. */
  actions?: ReactNode;
}

/** Roughly matches `--sf-duration-slow`; used to unmount the effect after its
 *  collapse animation when thinking ends. */
const COLLAPSE_MS = 500;

function toPadding(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

const ICON_PROPS = {
  viewBox: "0 0 16 16",
  width: 14,
  height: 14,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
} as const;

const ExpandIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" strokeLinecap="square" />
  </svg>
);
const CollapseIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" strokeLinecap="square" />
  </svg>
);
const CloseIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg {...ICON_PROPS}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" strokeLinecap="square" />
  </svg>
);

/** Panel header: caption + optional view switcher on the left, custom actions
 *  and the fullscreen/close pair on the right. Rendered inside the SplitPane so
 *  the close button can drive its open state. */
function PanelHeader({
  title,
  views,
  actions,
  expanded,
  onToggleFullscreen,
}: {
  title?: ReactNode;
  views?: ChatDrawerView[];
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
      <div className={styles.actions}>
        {actions}
        <button
          type="button"
          className={styles.iconButton}
          onClick={onToggleFullscreen}
          aria-label={expanded ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={expanded}
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <CloseIcon />
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
    resizable = true,
    defaultSize = 360,
    minSize,
    maxSize,
    onSizeChange,
    padding = 1,
    thinking = false,
    onThinkingStart,
    onThinkingEnd,
    effect = "ripple",
    color = "var(--sf-color-primary)",
    speed = 1,
    wash,
    messages,
    onSubmit,
    onAction,
    renderPart,
    placeholder,
    sendLabel,
    sendVariant,
    borderColor,
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
  const { expanded, toggle } = useFullscreen();

  const contentStyle: CSSProperties = { padding: toPadding(padding) };

  // `--cd-effect-color` tints the default wash; `--cd-wash` (set only when the
  // consumer customizes it) overrides the whole wash colour, or disables it.
  const panelStyle = {
    "--cd-effect-color": color,
    ...(wash !== undefined && { "--cd-wash": wash === false ? "transparent" : wash }),
    // Override SplitPane's inline size so the fullscreen overlay (inset:0) fills
    // the viewport. SplitPane spreads our style after its own, so this wins.
    ...(expanded && { inlineSize: "auto", blockSize: "auto" }),
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
              className={styles.fill}
            />
          ) : null}
        </div>
        <div className={styles.content} style={contentStyle}>
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
                actions={actions}
                expanded={expanded}
                onToggleFullscreen={toggle}
              />
              {views.map((view) => (
                <Tabs.Panel key={view.id} value={view.id} keepMounted className={styles.viewPanel}>
                  {view.content}
                </Tabs.Panel>
              ))}
            </Tabs.Root>
          ) : (
            <>
              <PanelHeader
                title={title}
                actions={actions}
                expanded={expanded}
                onToggleFullscreen={toggle}
              />
              <div className={styles.chatWrap}>
                <Chat
                  className={styles.chat}
                  height="100%"
                  messages={messages ?? []}
                  onSubmit={onSubmit ?? (() => {})}
                  onAction={onAction}
                  renderPart={renderPart}
                  placeholder={placeholder}
                  sendLabel={sendLabel}
                  sendVariant={sendVariant}
                  borderColor={borderColor}
                  disabled={disabled ?? thinking}
                />
              </div>
            </>
          )}
        </div>
        {/* Recess overlay — casts the inset shadow over the whole panel. */}
        <div className={styles.recess} aria-hidden="true" />
      </SplitPane.Panel>
    </SplitPane>
  );
});
