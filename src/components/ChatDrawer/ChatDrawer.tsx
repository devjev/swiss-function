import type { CSSProperties, ReactNode } from "react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { Chat, type ChatAction, type ChatMessage, type ChatPart } from "../Chat";
import { type EffectName, NonIdealState } from "../NonIdealState";
import { SplitPane, type SplitSide } from "../SplitPane";
import styles from "./ChatDrawer.module.css";

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

  /** Chat messages. */
  messages: ChatMessage[];
  /** Fired with the trimmed text when the user submits. */
  onSubmit: (text: string) => void;
  /** Fired when a user interacts with a choices / tree / custom block. */
  onAction?: (action: ChatAction) => void;
  /** Render a custom part by `type`. */
  renderPart?: (part: ChatPart, ctx: { message: ChatMessage }) => ReactNode;
  placeholder?: string;
  /** Disable the input. Defaults to `thinking` (input locks while the agent works). */
  disabled?: boolean;
}

/** Roughly matches `--sf-duration-slow`; used to unmount the effect after its
 *  collapse animation when thinking ends. */
const COLLAPSE_MS = 500;

function toPadding(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
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
    messages,
    onSubmit,
    onAction,
    renderPart,
    placeholder,
    disabled,
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

  const contentStyle: CSSProperties = { padding: toPadding(padding) };

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
        className={styles.panel}
        style={{ "--cd-effect-color": color } as CSSProperties}
      >
        {/* Static full-pane wash — a faint flat tint of the effect colour while
            thinking (no bloom), behind everything. */}
        <div className={styles.wash} data-open={revealed || undefined} aria-hidden="true" />
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
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          <div className={styles.chatWrap}>
            <Chat
              className={styles.chat}
              height="100%"
              messages={messages}
              onSubmit={onSubmit}
              onAction={onAction}
              renderPart={renderPart}
              placeholder={placeholder}
              disabled={disabled ?? thinking}
            />
          </div>
        </div>
      </SplitPane.Panel>
    </SplitPane>
  );
});
