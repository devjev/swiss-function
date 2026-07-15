import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import {
  Children,
  cloneElement,
  createElement,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { Markdown } from "../Markdown";
import styles from "./StreamingTerminalText.module.css";

const WS = /\s/;
const SHADE_TEST = /[▒▓█]/;
const SHADE_SPLIT = /([▒▓█]+)/;
const SHADE_ONLY = /^[▒▓█]+$/;

/** Replace runs of shade-block glyphs with a styled span so the developing
 *  tail can be tinted (e.g., primary) without affecting resolved text. */
function splitShade(text: string): ReactNode {
  if (!SHADE_TEST.test(text)) return text;
  return text.split(SHADE_SPLIT).map((part, i) =>
    SHADE_ONLY.test(part) ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: split parts have no stable identity
      <span key={i} className={styles.shade}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function transformChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return splitShade(child);
    if (isValidElement<{ children?: ReactNode }>(child) && child.props.children !== undefined) {
      return cloneElement(child, {} as never, transformChildren(child.props.children));
    }
    return child;
  });
}

/** Passthrough renderer for a given HTML tag that wraps shade-block runs in
 *  styled spans. Used as a react-markdown `components` override. */
// biome-ignore lint/suspicious/noExplicitAny: react-markdown component prop signatures
function wrapTag(Tag: keyof React.JSX.IntrinsicElements): (props: any) => React.JSX.Element {
  return function WrappedTag(props) {
    const { node: _node, children, ...rest } = props;
    return createElement(Tag, rest, transformChildren(children));
  };
}

const SHADE_COMPONENTS: ComponentProps<typeof Markdown>["components"] = {
  p: wrapTag("p"),
  h1: wrapTag("h1"),
  h2: wrapTag("h2"),
  h3: wrapTag("h3"),
  h4: wrapTag("h4"),
  h5: wrapTag("h5"),
  h6: wrapTag("h6"),
  li: wrapTag("li"),
  code: wrapTag("code"),
  blockquote: wrapTag("blockquote"),
  th: wrapTag("th"),
  td: wrapTag("td"),
};

export interface StreamingTerminalTextProps extends HTMLAttributes<HTMLDivElement> {
  /** The full text received so far. Grows as new chunks arrive. */
  content: string;
  /** True once no more text will arrive. */
  isComplete: boolean;
  /** Fired once when the reveal has caught up to all of `content` and
   *  `isComplete` is true — i.e. the animation has fully finished. Lets a
   *  parent (e.g. Chat) keep this component mounted until the reveal lands,
   *  then hand off to a static render without a visible jump. */
  onRevealComplete?: () => void;
  /** Unrevealed non-whitespace letters held in the developing tail. */
  tailLength?: number;
  /** Reveal cadence. `"dramatic"` (default) reveals one resolved character per
   *  tick, a steady per-character shimmer good for scripted text. `"stream"`
   *  reveals everything except the shade tail on each tick, so the text tracks
   *  a live token stream as it arrives (only the tail shimmers) instead of
   *  lagging behind a fast source and then bursting to catch up at the end. */
  mode?: "dramatic" | "stream";
  /** Milliseconds per resolved tick. */
  charIntervalMs?: number;
  /** Shade glyphs from far-end (low density) to near-end (high density). */
  shadeRamp?: string[];
  /** Glyph used to fill spaces inside the developing tail. */
  spacePlaceholder?: string;
}

function computePositions(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    if (!WS.test(ch)) out.push(i);
  }
  return out;
}

export const StreamingTerminalText = forwardRef<HTMLDivElement, StreamingTerminalTextProps>(
  function StreamingTerminalText(
    {
      content,
      isComplete,
      onRevealComplete,
      tailLength = 3,
      mode = "dramatic",
      charIntervalMs = 64,
      shadeRamp = ["▒", "▓"],
      spacePlaceholder = " ",
      className,
      ...rest
    },
    ref,
  ) {
    const [revealedCount, setRevealedCount] = useState(0);

    // Honor reduced-motion: skip the per-char shimmer and show everything
    // received so far at once. Updates live if the user toggles the setting.
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches);
      const handler = () => setReduced(mq.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }, []);

    const positions = useMemo(() => computePositions(content), [content]);

    // Refs so the interval can read latest values without restarting on
    // every content update (which would jitter the cadence under bursty
    // token arrival).
    const positionsRef = useRef(positions);
    const isCompleteRef = useRef(isComplete);
    const tailLengthRef = useRef(tailLength);
    const modeRef = useRef(mode);
    useEffect(() => {
      positionsRef.current = positions;
      isCompleteRef.current = isComplete;
      tailLengthRef.current = tailLength;
      modeRef.current = mode;
    });

    useEffect(() => {
      const id = window.setInterval(() => {
        setRevealedCount((rc) => {
          const p = positionsRef.current;
          const tail = tailLengthRef.current;
          const cap = isCompleteRef.current ? p.length : Math.max(0, p.length - tail);
          if (rc >= cap) return rc;
          // Once complete, drain any backlog proportionally so a fast-arrived
          // message finishes in ~24 ticks (≈1.5 s) instead of crawling — and is
          // never abandoned by a hard swap to static markdown. While streaming:
          // `"dramatic"` is a steady one-char shimmer (scripted feel);
          // `"stream"` reveals to the cap each tick, so the text tracks a live
          // token stream and only the shade tail shimmers — no slow-then-fast.
          let step: number;
          if (isCompleteRef.current) step = Math.max(1, Math.ceil((cap - rc) / 24));
          else if (modeRef.current === "stream") step = cap - rc;
          else step = 1;
          return Math.min(cap, rc + step);
        });
      }, charIntervalMs);
      return () => window.clearInterval(id);
    }, [charIntervalMs]);

    // Reset reveal when content shrinks — consumer cleared it to start a new
    // message. Without this the next message would render fully-revealed from
    // tick zero because revealedCount is still at the previous high.
    const prevContentLen = useRef(0);
    useEffect(() => {
      if (content.length < prevContentLen.current) setRevealedCount(0);
      prevContentLen.current = content.length;
    }, [content]);

    // Under reduced motion the whole received string is shown at once — no
    // per-char reveal and no developing tail.
    const effectiveRevealed = reduced ? positions.length : revealedCount;

    // Fire once when the reveal has caught up to all of `content` and no more
    // is coming. Re-arms if `content` grows again afterwards.
    const completeFiredRef = useRef(false);
    useEffect(() => {
      if (isComplete && effectiveRevealed >= positions.length) {
        if (!completeFiredRef.current) {
          completeFiredRef.current = true;
          onRevealComplete?.();
        }
      } else {
        completeFiredRef.current = false;
      }
    }, [isComplete, effectiveRevealed, positions.length, onRevealComplete]);

    // Resolved boundary + tail glyph string built into a single source string,
    // then passed through Markdown. Each block gets its proper styling as
    // soon as it appears — no swap, no size jump.
    const boundary =
      effectiveRevealed < positions.length
        ? (positions[effectiveRevealed] as number)
        : content.length;
    let tailStr = "";
    if (effectiveRevealed < positions.length) {
      const lastTailPos = Math.min(effectiveRevealed + tailLength, positions.length) - 1;
      const lastTailIdx = positions[lastTailPos] as number;
      let rank = 0;
      const rampLen = shadeRamp.length;
      const denom = Math.max(1, tailLength - 1);
      for (let i = boundary; i <= lastTailIdx; i++) {
        const ch = content[i] as string;
        if (ch === "\n") {
          tailStr += "\n";
          continue;
        }
        if (WS.test(ch)) {
          tailStr += spacePlaceholder;
          continue;
        }
        const stage = Math.max(
          0,
          Math.min(rampLen - 1, Math.round(((rampLen - 1) * (tailLength - 1 - rank)) / denom)),
        );
        tailStr += shadeRamp[stage] ?? shadeRamp[0] ?? "▒";
        rank++;
      }
    }

    const renderedSource = content.slice(0, boundary) + tailStr;

    return (
      <div ref={ref} {...rest} className={cx(styles.root, className)} data-testid="streaming-text">
        <Markdown value={renderedSource} components={SHADE_COMPONENTS} />
      </div>
    );
  },
);
