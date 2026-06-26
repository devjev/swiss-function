import type { HTMLAttributes, ReactNode } from "react";
import { Children, createContext, forwardRef, isValidElement, useContext } from "react";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { useCollapse } from "../../lib/useCollapse";
import { Popover } from "../Popover";
import styles from "./Toolbar.module.css";

function toUnit(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

// Tells each Item/Separator/Spacer which surface it's rendering into, so the
// same declared control adapts to the row or the collapsed panel (the
// ToggleGroup/CommandBar context-cascade pattern).
type ToolbarSurface = "row" | "panel";
const ToolbarSurfaceContext = createContext<ToolbarSurface>("row");

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M2 4h12M2 8h12M2 12h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

// --- Item (generic control slot) -----------------------------------------

export interface ToolbarItemProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Label shown beside the control when the toolbar is collapsed into the
   * panel (e.g. "Wrap" next to a Switch). Omit for self-describing controls
   * like a labelled button.
   */
  label?: ReactNode;
}

const Item = forwardRef<HTMLDivElement, ToolbarItemProps>(function ToolbarItem(
  { label, className, children, ...rest },
  ref,
) {
  const surface = useContext(ToolbarSurfaceContext);
  if (surface === "panel") {
    return (
      <div {...rest} ref={ref} className={cx(styles.panelItem, className)}>
        {label != null ? <span className={styles.panelLabel}>{label}</span> : null}
        <div className={styles.panelControl}>{children}</div>
      </div>
    );
  }
  return (
    <div {...rest} ref={ref} className={cx(styles.item, className)}>
      {children}
    </div>
  );
});

// --- Start (persistent left slot) / Separator / Spacer -------------------

const Start = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function ToolbarStart(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.start, className)} />;
});

const Separator = forwardRef<HTMLHRElement, HTMLAttributes<HTMLHRElement>>(
  function ToolbarSeparator({ className, ...rest }, ref) {
    const surface = useContext(ToolbarSurfaceContext);
    // Native <hr> carries the implicit separator role.
    return (
      <hr
        {...rest}
        ref={ref}
        aria-orientation={surface === "panel" ? "horizontal" : "vertical"}
        className={cx(surface === "panel" ? styles.panelSeparator : styles.separator, className)}
      />
    );
  },
);

function Spacer() {
  const surface = useContext(ToolbarSurfaceContext);
  // Only meaningful in the row; the panel stacks vertically.
  return surface === "panel" ? null : <div className={styles.spacer} aria-hidden="true" />;
}

// --- Root ----------------------------------------------------------------

export interface ToolbarRootProps extends HTMLAttributes<HTMLDivElement> {
  /** Collapse threshold; `number` → `--sf-unit` multiples. Default `24`. */
  collapseAt?: number | string;
  /** Row item gap; `number` → `--sf-unit` multiples. Default `0.5`. */
  gap?: number | string;
  /** Accessible name for the icon-only collapsed trigger. Default `"Menu"`. */
  menuLabel?: string;
  /** Override the hamburger glyph. */
  menuIcon?: ReactNode;
}

const Root = forwardRef<HTMLDivElement, ToolbarRootProps>(function ToolbarRoot(
  { collapseAt, gap = 0.5, menuLabel = "Menu", menuIcon, className, style, children, ...rest },
  ref,
) {
  const { ref: collapseRef, collapsed } = useCollapse<HTMLDivElement>({ collapseAt });

  const childArray = Children.toArray(children);
  const isStart = (c: ReturnType<typeof Children.toArray>[number]) =>
    isValidElement(c) && c.type === Start;
  const startEls = childArray.filter(isStart);
  const itemEls = childArray.filter((c) => !isStart(c));

  return (
    <div
      {...rest}
      ref={mergeRefs(collapseRef, ref)}
      role="toolbar"
      aria-orientation="horizontal"
      className={cx(styles.root, className)}
      style={{ gap: toUnit(gap), ...style }}
    >
      {startEls}
      {collapsed ? (
        <Popover.Root>
          <Popover.Trigger className={styles.trigger} aria-label={menuLabel}>
            {menuIcon ?? <HamburgerIcon />}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="end" sideOffset={4}>
              <Popover.Popup className={styles.panel}>
                <ToolbarSurfaceContext.Provider value="panel">
                  {itemEls}
                </ToolbarSurfaceContext.Provider>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <ToolbarSurfaceContext.Provider value="row">{itemEls}</ToolbarSurfaceContext.Provider>
      )}
    </div>
  );
});

export const Toolbar = { Root, Item, Start, Separator, Spacer };
