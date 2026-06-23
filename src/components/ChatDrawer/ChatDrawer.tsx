import type { CSSProperties, ReactElement, ReactNode } from "react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { Chat, type ChatAction, type ChatMessage, type ChatPart } from "../Chat";
import { Drawer, type DrawerSide } from "../Drawer";
import { type EffectName, NonIdealState } from "../NonIdealState";
import styles from "./ChatDrawer.module.css";

export interface ChatDrawerProps {
  /** Element that opens the drawer (rendered as the drawer trigger). */
  trigger?: ReactElement;
  /** Edge the drawer slides in from. Default `"right"`. */
  side?: DrawerSide;
  /** Controlled open state (Base UI Drawer). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional accessible title for the panel. */
  title?: ReactNode;

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

/** A chat inside an edge drawer. While `thinking`, an animated `NonIdealState`
 *  effect blooms from the centre outward (starting from zero) and fills the
 *  padding frame around the chat; it clears when thinking ends. */
export const ChatDrawer = forwardRef<HTMLDivElement, ChatDrawerProps>(function ChatDrawer(
  {
    trigger,
    side = "right",
    open,
    defaultOpen,
    onOpenChange,
    title,
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
    <Drawer.Root side={side} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {trigger ? <Drawer.Trigger render={trigger} /> : null}
      <Drawer.Portal>
        <Drawer.Popup ref={ref} className={styles.popup}>
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
            {title ? <Drawer.Title className={styles.title}>{title}</Drawer.Title> : null}
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
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>
  );
});
