/** Stack — a resize-aware fill/stretch layout (issue #74). Lay children in a
 *  column (or row); every child keeps its natural size, and a region wrapped in
 *  `Stack.Fill` stretches to absorb the remaining space and stays locked to the
 *  edge as the container (a resizable `Dialog.Popup`, a panel) resizes. It
 *  encapsulates the fiddly flex + `min-*-size: 0` chain that this pattern needs
 *  by hand, where forgetting one `min-block-size: 0` silently collapses the fill.
 *
 *  Pair with a stretchable control (`<TextEdit fill />`) inside `Stack.Fill` for
 *  a "this field grows to the bottom edge" region that reads declaratively.
 */

import type { CSSProperties, HTMLAttributes } from "react";
import { createContext, forwardRef, useContext } from "react";
import { cx } from "../../lib/cx";
import styles from "./Stack.module.css";

export type StackDirection = "vertical" | "horizontal";

const StackDirectionContext = createContext<StackDirection>("vertical");

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Main axis. `"vertical"` (default) stacks in a column, `"horizontal"` in a row. */
  direction?: StackDirection;
  /** Gap between children, in `--sf-unit` multiples. Default `0`. */
  gap?: number;
  /** Make the stack itself grow to fill its parent (a flex item grows, a
   *  definite-size parent is filled). Set this on the stack that is a resizable
   *  region's body so the `Stack.Fill` inside has space to expand into. */
  fill?: boolean;
}

const Root = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { direction = "vertical", gap = 0, fill = false, className, style, children, ...rest },
  ref,
) {
  return (
    <StackDirectionContext.Provider value={direction}>
      <div
        {...rest}
        ref={ref}
        className={cx(styles.root, className)}
        data-direction={direction}
        data-fill={fill || undefined}
        style={{ "--stack-gap": `calc(var(--sf-unit) * ${gap})`, ...style } as CSSProperties}
      >
        {children}
      </div>
    </StackDirectionContext.Provider>
  );
});

export type StackFillProps = HTMLAttributes<HTMLDivElement>;

/** The growing region: it stretches to fill the stack's remaining space and its
 *  lone child fills it in turn (so a `<TextEdit fill />` locks to the edge). */
const Fill = forwardRef<HTMLDivElement, StackFillProps>(function StackFill(
  { className, children, ...rest },
  ref,
) {
  const direction = useContext(StackDirectionContext);
  return (
    <div {...rest} ref={ref} className={cx(styles.fill, className)} data-direction={direction}>
      {children}
    </div>
  );
});

export const Stack = Object.assign(Root, { Fill });
