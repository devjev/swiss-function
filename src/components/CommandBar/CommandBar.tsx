import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Menubar as BaseMenubar } from "@base-ui/react/menubar";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { createContext, forwardRef, useContext } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { Box } from "../Box";
import { Input, type InputProps } from "../Input";
import styles from "./CommandBar.module.css";

export type CommandBarPosition = "top" | "bottom";

// Share the bar's position with descendant Content/SubmenuContent so they can
// flip the popup side (e.g. open upward when the bar is at the bottom).
const PositionContext = createContext<CommandBarPosition>("top");

// --- Root --------------------------------------------------------------

interface CommandBarRootProps extends ComponentPropsWithoutRef<typeof BaseMenubar> {
  /** Which edge gets the subtle hairline border. Default "top". */
  position?: CommandBarPosition;
}

const Root = forwardRef<HTMLDivElement, CommandBarRootProps>(function CommandBarRoot(
  { className, position = "top", ...rest },
  ref,
) {
  const positionClass = position === "bottom" ? styles.positionBottom : styles.positionTop;
  return (
    <PositionContext.Provider value={position}>
      <BaseMenubar
        {...rest}
        ref={ref}
        className={mergeClassName(`${styles.root} ${positionClass}`, className)}
      />
    </PositionContext.Provider>
  );
});

// --- Menu / Trigger ----------------------------------------------------

const Menu = BaseMenu.Root;

const Trigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof BaseMenu.Trigger>>(
  function CommandBarTrigger({ className, ...rest }, ref) {
    return (
      <BaseMenu.Trigger {...rest} ref={ref} className={mergeClassName(styles.trigger, className)} />
    );
  },
);

// --- Content (Portal + Positioner + Popup with Box chrome) -------------

const Content = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Popup>>(
  function CommandBarContent({ className, children, ...rest }, ref) {
    const position = useContext(PositionContext);
    // Bar at top → menus open down (side="bottom"); bar at bottom → open up.
    const side = position === "bottom" ? "top" : "bottom";
    return (
      <BaseMenu.Portal>
        <BaseMenu.Positioner side={side} sideOffset={4} align="start">
          <BaseMenu.Popup
            {...rest}
            ref={ref}
            className={mergeClassName(styles.popup, className)}
            render={<Box elevation={3} padding={0.25} />}
          >
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    );
  },
);

// --- Item --------------------------------------------------------------

interface CommandBarItemProps extends ComponentPropsWithoutRef<typeof BaseMenu.Item> {
  /** Right-aligned hint text. Also mirrored to `aria-keyshortcuts`. */
  shortcut?: string;
  children?: ReactNode;
}

const Item = forwardRef<HTMLDivElement, CommandBarItemProps>(function CommandBarItem(
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

const Separator = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseMenu.Separator>>(
  function CommandBarSeparator({ className, ...rest }, ref) {
    return (
      <BaseMenu.Separator
        {...rest}
        ref={ref}
        className={mergeClassName(styles.separator, className)}
      />
    );
  },
);

// --- Submenu -----------------------------------------------------------

const Submenu = BaseMenu.SubmenuRoot;

const SubmenuTrigger = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof BaseMenu.SubmenuTrigger>
>(function CommandBarSubmenuTrigger({ className, children, ...rest }, ref) {
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

// SubmenuContent is the same Portal/Positioner/Popup tree as Content but
// typically anchored differently — the user composes via Base UI defaults.
const SubmenuContent = Content;

// --- Logo (left slot) -------------------------------------------------

const Logo = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function CommandBarLogo(
  { className, ...rest },
  ref,
) {
  return <div {...rest} ref={ref} className={cx(styles.logo, className)} />;
});

// --- Search (right slot — wraps Input; auto-margins itself to the right) --

const Search = forwardRef<HTMLInputElement, InputProps>(function CommandBarSearch(
  { className, inputSize = "sm", type = "search", ...rest },
  ref,
) {
  return (
    <Input
      {...rest}
      ref={ref}
      type={type}
      inputSize={inputSize}
      className={mergeClassName(styles.search, className)}
    />
  );
});

export const CommandBar = {
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
};
