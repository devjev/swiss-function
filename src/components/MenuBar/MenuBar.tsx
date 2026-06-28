import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode, Ref } from "react";
import { Children, createContext, forwardRef, isValidElement, useContext } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { useCollapse } from "../../lib/useCollapse";
import { useOverflow } from "../../lib/useOverflow";
import { Box } from "../Box";
import { Input, type InputProps } from "../Input";
import { Popover } from "../Popover";
import styles from "./MenuBar.module.css";

export type MenuBarPosition = "top" | "bottom";

function toUnit(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

// Share the bar's position with descendant Content/SubmenuContent so they can
// flip the popup side (e.g. open upward when the bar is at the bottom).
const PositionContext = createContext<MenuBarPosition>("top");

// Tells bar-level parts (Trigger / Control / Spacer / bar Separator) which
// surface they render into, so the same declared part adapts to the inline row
// or the collapsed ☰ panel (the ToggleGroup context-cascade pattern).
type MenuBarSurface = "row" | "panel";
const SurfaceContext = createContext<MenuBarSurface>("row");

// Set true by Content/SubmenuContent so a Separator placed inside a dropdown
// renders as a menu separator, while one placed directly in the bar renders as
// a bar rule.
const InMenuContext = createContext(false);

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

function OverflowIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  );
}

// The ☰/⋯ trigger + the Popover panel that renders the folded items. Shared by
// both the all-at-once (`"all"`) and progressive (`"items"`) collapse modes.
function CollapsedMenu({
  items,
  side,
  align,
  label,
  icon,
  triggerClassName,
}: {
  items: ReactNode;
  side: "top" | "bottom";
  align: "start" | "end";
  label: string;
  icon: ReactNode;
  triggerClassName: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className={triggerClassName} aria-label={label}>
        {icon}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} align={align} sideOffset={4}>
          <Popover.Popup className={styles.panel}>
            <SurfaceContext.Provider value="panel">{items}</SurfaceContext.Provider>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

// --- Root --------------------------------------------------------------

export type MenuBarCollapse = "none" | "all" | "items";

interface MenuBarRootProps extends ComponentPropsWithoutRef<typeof BaseMenubar> {
  /** Which edge gets the subtle hairline border. Default "top". */
  position?: MenuBarPosition;
  /** Draw the hairline border on the `position` edge. Default `true`. */
  bordered?: boolean;
  /**
   * Responsive collapse behaviour:
   * - `"none"` — never collapse (a plain menu bar).
   * - `"all"` — fold the whole bar behind one ☰ when narrower than `collapseAt`.
   * - `"items"` — progressively fold items into a ⋯ overflow menu from the
   *   trailing edge, keeping as many inline as fit (`collapseAt` is ignored).
   *
   * Defaults to `"all"` when `collapseAt` is set, otherwise `"none"`.
   */
  collapse?: MenuBarCollapse;
  /**
   * Collapse threshold for `collapse="all"`. When the bar's container is narrower
   * than this, everything except the `Logo` folds behind a ☰ panel. `number` →
   * `--sf-unit` multiples, `string` → any CSS length.
   */
  collapseAt?: number | string;
  /** Gap between bar items. `number` → `--sf-unit` multiples. Default `0`. */
  gap?: number | string;
  /** Accessible name for the icon-only collapsed trigger. Default `"Menu"`. */
  menuLabel?: string;
  /** Override the hamburger glyph. */
  menuIcon?: ReactNode;
  /**
   * Which side the collapsed ☰ trigger sits on. `"end"` (default) pins it to the
   * far edge; `"start"` keeps it next to the `Logo`, where the menus used to be.
   */
  menuAlign?: "start" | "end";
}

const Root = forwardRef<HTMLDivElement, MenuBarRootProps>(function MenuBarRoot(
  {
    className,
    position = "top",
    bordered = true,
    collapse,
    collapseAt,
    gap = 0,
    menuLabel = "Menu",
    menuIcon,
    menuAlign = "end",
    style,
    children,
    ...rest
  },
  ref,
) {
  const mode: MenuBarCollapse = collapse ?? (collapseAt != null ? "all" : "none");

  // Hooks must run unconditionally; each is inert unless its mode is active.
  const { ref: collapseRef, collapsed } = useCollapse<HTMLDivElement>({ collapseAt });
  const {
    rootRef: overflowRootRef,
    ghostRef,
    visibleCount,
  } = useOverflow<HTMLDivElement>({
    enabled: mode === "items",
  });

  // The position classes only carry the hairline; drop them to render borderless.
  const positionClass = !bordered
    ? ""
    : position === "bottom"
      ? styles.positionBottom
      : styles.positionTop;
  const rootClass = positionClass ? `${styles.root} ${positionClass}` : styles.root;
  // Bar at top → panels open down; bar at bottom → open up.
  const panelSide = position === "bottom" ? "top" : "bottom";
  const barStyle = { gap: toUnit(gap), ...style };

  // Logo elements stay persistent in the bar; everything else folds.
  const childArray = Children.toArray(children);
  const isLogo = (c: ReturnType<typeof Children.toArray>[number]) =>
    isValidElement(c) && c.type === Logo;
  const logoEls = childArray.filter(isLogo);
  const restEls = childArray.filter((c) => !isLogo(c));

  // --- Progressive overflow ("items") ---
  if (mode === "items") {
    const total = restEls.length;
    const shown = Math.min(total, visibleCount);
    const overflowEls = restEls.slice(shown);
    return (
      <PositionContext.Provider value={position}>
        <div className={styles.overflowWrap}>
          {/* Hidden, inert clone of the full bar — measured to decide the cut. */}
          <div
            ref={ghostRef}
            className={cx(rootClass, styles.ghost)}
            style={barStyle}
            aria-hidden
            inert
          >
            {logoEls}
            {restEls.map((el, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: positional measurement wrappers
              <span key={i} data-overflow-item className={styles.ghostItem}>
                {el}
              </span>
            ))}
            <span data-overflow-trigger className={cx(styles.barTrigger, styles.ghostTrigger)}>
              <OverflowIcon />
            </span>
          </div>
          <BaseMenubar
            {...rest}
            ref={mergeRefs(overflowRootRef, ref)}
            className={mergeClassName(rootClass, className)}
            style={barStyle}
          >
            {logoEls}
            <SurfaceContext.Provider value="row">{restEls.slice(0, shown)}</SurfaceContext.Provider>
            {shown < total ? (
              <CollapsedMenu
                items={overflowEls}
                side={panelSide}
                align="end"
                label={menuLabel}
                icon={menuIcon ?? <OverflowIcon />}
                triggerClassName={cx(styles.barTrigger, styles.barTriggerEnd)}
              />
            ) : null}
          </BaseMenubar>
        </div>
      </PositionContext.Provider>
    );
  }

  // --- All-at-once ("all") / never ("none") ---
  const enabled = mode === "all" && collapseAt != null;
  const isCollapsed = enabled && collapsed;
  return (
    <PositionContext.Provider value={position}>
      <BaseMenubar
        {...rest}
        ref={enabled ? mergeRefs(collapseRef, ref) : ref}
        className={mergeClassName(rootClass, className)}
        style={barStyle}
      >
        {logoEls}
        {isCollapsed ? (
          <CollapsedMenu
            items={restEls}
            side={panelSide}
            align={menuAlign}
            label={menuLabel}
            icon={menuIcon ?? <HamburgerIcon />}
            triggerClassName={cx(styles.barTrigger, menuAlign === "end" && styles.barTriggerEnd)}
          />
        ) : (
          <SurfaceContext.Provider value="row">{restEls}</SurfaceContext.Provider>
        )}
      </BaseMenubar>
    </PositionContext.Provider>
  );
});

// --- Menu / Trigger ----------------------------------------------------

const Menu = BaseMenu.Root;

const Trigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof BaseMenu.Trigger>>(
  function MenuBarTrigger({ className, ...rest }, ref) {
    const surface = useContext(SurfaceContext);
    return (
      <BaseMenu.Trigger
        {...rest}
        ref={ref}
        className={mergeClassName(
          surface === "panel" ? `${styles.trigger} ${styles.triggerPanel}` : styles.trigger,
          className,
        )}
      />
    );
  },
);

// --- Content (Portal + Positioner + Popup with Box chrome) -------------

const Content = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Popup>>(
  function MenuBarContent({ className, children, ...rest }, ref) {
    const position = useContext(PositionContext);
    // Bar at top → menus open down (side="bottom"); bar at bottom → open up.
    const side = position === "bottom" ? "top" : "bottom";
    return (
      <BaseMenu.Portal>
        <BaseMenu.Positioner className={styles.positioner} side={side} sideOffset={4} align="start">
          <BaseMenu.Popup
            {...rest}
            ref={ref}
            className={mergeClassName(styles.popup, className)}
            render={<Box elevation={3} padding={0.25} />}
          >
            <InMenuContext.Provider value={true}>{children}</InMenuContext.Provider>
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    );
  },
);

// --- Item --------------------------------------------------------------

interface MenuBarItemProps extends ComponentPropsWithoutRef<typeof BaseMenu.Item> {
  /** Right-aligned hint text. Also mirrored to `aria-keyshortcuts`. */
  shortcut?: string;
  children?: ReactNode;
}

const Item = forwardRef<HTMLDivElement, MenuBarItemProps>(function MenuBarItem(
  { className, shortcut, children, ...rest },
  ref,
) {
  return (
    <BaseMenu.Item
      {...rest}
      ref={ref}
      className={mergeClassName(styles.item, className)}
      aria-keyshortcuts={shortcut}
    >
      <span>{children}</span>
      {shortcut ? <span className={styles.shortcut}>{shortcut}</span> : <span />}
    </BaseMenu.Item>
  );
});

// --- Separator ---------------------------------------------------------
// Dual-purpose: a menu separator inside a dropdown (Content), a bar rule when
// placed directly in the bar (vertical in the row, horizontal in the panel).

const Separator = forwardRef<HTMLHRElement, HTMLAttributes<HTMLHRElement>>(
  function MenuBarSeparator({ className, ...rest }, ref) {
    const inMenu = useContext(InMenuContext);
    const surface = useContext(SurfaceContext);

    if (inMenu) {
      return (
        <BaseMenu.Separator
          {...(rest as ComponentPropsWithoutRef<typeof BaseMenu.Separator>)}
          ref={ref as Ref<HTMLDivElement>}
          className={mergeClassName(styles.separator, className)}
        />
      );
    }

    // Native <hr> carries the implicit separator role.
    return (
      <hr
        {...rest}
        ref={ref}
        aria-orientation={surface === "panel" ? "horizontal" : "vertical"}
        className={cx(
          surface === "panel" ? styles.barSeparatorPanel : styles.barSeparator,
          className,
        )}
      />
    );
  },
);

// --- Submenu -----------------------------------------------------------

const Submenu = BaseMenu.SubmenuRoot;

const SubmenuTrigger = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof BaseMenu.SubmenuTrigger>
>(function MenuBarSubmenuTrigger({ className, children, ...rest }, ref) {
  return (
    <BaseMenu.SubmenuTrigger
      {...rest}
      ref={ref}
      className={mergeClassName(`${styles.item} ${styles.submenuTrigger}`, className)}
    >
      <span>{children}</span>
    </BaseMenu.SubmenuTrigger>
  );
});

// SubmenuContent is the same Portal/Positioner/Popup tree as Content.
const SubmenuContent = Content;

// --- Logo (persistent left slot) ---------------------------------------

const Logo = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function MenuBarLogo(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.logo, className)} />;
});

// --- Search (right slot — wraps Input; auto-margins itself to the right) --

const Search = forwardRef<HTMLInputElement, InputProps>(function MenuBarSearch(
  { className, inputSize = "sm", type = "search", ...rest },
  ref,
) {
  const surface = useContext(SurfaceContext);
  return (
    <Input
      {...rest}
      ref={ref}
      type={type}
      inputSize={inputSize}
      className={mergeClassName(
        cx(styles.search, surface === "panel" && styles.searchPanel),
        className,
      )}
    />
  );
});

// --- Control (generic in-place control slot) ---------------------------

export interface MenuBarControlProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Label shown beside the control when the bar is collapsed into the panel
   * (e.g. "Wrap" next to a Switch). Omit for self-describing controls like a
   * labelled button.
   */
  label?: ReactNode;
}

const Control = forwardRef<HTMLDivElement, MenuBarControlProps>(function MenuBarControl(
  { label, className, children, ...rest },
  ref,
) {
  const surface = useContext(SurfaceContext);
  if (surface === "panel") {
    return (
      <div {...rest} ref={ref} className={cx(styles.panelItem, className)}>
        {label != null ? <span className={styles.panelLabel}>{label}</span> : null}
        <div className={styles.panelControl}>{children}</div>
      </div>
    );
  }
  return (
    <div {...rest} ref={ref} className={cx(styles.control, className)}>
      {children}
    </div>
  );
});

// --- Spacer ------------------------------------------------------------

function Spacer() {
  const surface = useContext(SurfaceContext);
  // Only meaningful in the row; the panel stacks vertically.
  return surface === "panel" ? null : <div className={styles.spacer} aria-hidden="true" />;
}

export const MenuBar = {
  Root,
  Menu,
  Trigger,
  Content,
  Item,
  Separator,
  Submenu,
  SubmenuTrigger,
  SubmenuContent,
  Logo,
  Search,
  Control,
  Spacer,
};
