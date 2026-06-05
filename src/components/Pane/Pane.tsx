import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./Pane.module.css";

/**
 * A full-height region that splits into an auto-sized Header row and a
 * scrollable Body row — the canonical "auto / 1fr" recipe with the
 * cascading `min-block-size: 0` already wired in so consumers don't have
 * to re-derive it on every page.
 *
 * Nests cleanly: a Pane inside another Pane.Body works because the
 * outer Body already declares `min-block-size: 0`.
 */
export interface PaneRootProps extends HTMLAttributes<HTMLDivElement> {}

const Root = forwardRef<HTMLDivElement, PaneRootProps>(function PaneRoot(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.root, className)} />;
});

export interface PaneHeaderProps extends HTMLAttributes<HTMLDivElement> {}

const Header = forwardRef<HTMLDivElement, PaneHeaderProps>(function PaneHeader(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.header, className)} />;
});

export interface PaneBodyProps extends HTMLAttributes<HTMLDivElement> {}

const Body = forwardRef<HTMLDivElement, PaneBodyProps>(function PaneBody(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.body, className)} />;
});

export const Pane = Object.assign(Root, { Header, Body });
