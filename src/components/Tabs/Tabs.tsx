import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentPropsWithoutRef, ReactElement } from "react";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useLayoutEffect,
  useState,
} from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { useOverflow } from "../../lib/useOverflow";
import { Menu } from "../Menu";
import styles from "./Tabs.module.css";

const Root = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.Root>>(
  function TabsRoot({ className, ...rest }, ref) {
    return <BaseTabs.Root {...rest} ref={ref} className={mergeClassName(styles.root, className)} />;
  },
);

const Tab = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof BaseTabs.Tab>>(
  function TabsTab({ className, children, ...rest }, ref) {
    // Selecting a tab bolds its caption; bold text is wider, so without a width
    // reserve the whole row reflows (issue #41). When the label is plain text we
    // stash it in `data-text` and let CSS paint a hidden bold copy underneath —
    // the tab always sizes to its bold width, so weight can change with no jump.
    const label = typeof children === "string" ? children : undefined;
    return (
      <BaseTabs.Tab {...rest} ref={ref} className={mergeClassName(styles.tab, className)}>
        <span className={styles.label} data-text={label}>
          {children}
        </span>
      </BaseTabs.Tab>
    );
  },
);

const Indicator = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<typeof BaseTabs.Indicator>>(
  function TabsIndicator({ className, ...rest }, ref) {
    return (
      <BaseTabs.Indicator
        {...rest}
        ref={ref}
        className={mergeClassName(styles.indicator, className)}
      />
    );
  },
);

const Panel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.Panel>>(
  function TabsPanel({ className, ...rest }, ref) {
    return (
      <BaseTabs.Panel {...rest} ref={ref} className={mergeClassName(styles.panel, className)} />
    );
  },
);

function OverflowIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  );
}

type TabElement = ReactElement<ComponentPropsWithoutRef<typeof Tab>>;

const isTab = (c: unknown): c is TabElement => isValidElement(c) && c.type === Tab;

export interface TabsListProps extends ComponentPropsWithoutRef<typeof BaseTabs.List> {
  /**
   * Fold tabs that don't fit into a trailing `⋯` overflow menu instead of
   * overrunning the row. Container-width based (works in split panes/sidebars).
   * The selected tab is always kept visible. Off by default.
   */
  overflow?: boolean;
  /** Accessible name for the `⋯` overflow trigger. Default `"More tabs"`. */
  menuLabel?: string;
}

const List = forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
  { overflow, menuLabel, ...rest },
  ref,
) {
  if (overflow) {
    return <OverflowList {...rest} ref={ref} menuLabel={menuLabel ?? "More tabs"} />;
  }
  const { className, ...bare } = rest;
  return <BaseTabs.List {...bare} ref={ref} className={mergeClassName(styles.list, className)} />;
});

const OverflowList = forwardRef<HTMLDivElement, Omit<TabsListProps, "overflow">>(
  function TabsOverflowList({ className, children, menuLabel = "More tabs", ...rest }, ref) {
    const { rootRef, ghostRef, visibleCount } = useOverflow<HTMLDivElement>();
    const [activeIndex, setActiveIndex] = useState(-1);

    // Tabs fold; anything else (typically the Indicator) rides along untouched.
    const childArray = Children.toArray(children);
    const tabEls = childArray.filter(isTab);
    const otherEls = childArray.filter((c) => !isTab(c));
    const total = tabEls.length;

    // Track which tab is selected so it can be kept visible. Base UI owns the
    // selection in a context this component doesn't consume, so a selection
    // change doesn't re-render us; watch `aria-selected` in the DOM instead
    // (works controlled or uncontrolled, no private Base UI context).
    useLayoutEffect(() => {
      const list = rootRef.current;
      if (!list || typeof MutationObserver === "undefined") return;
      const read = () => {
        const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
        const idx = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
        setActiveIndex((prev) => (prev === idx ? prev : idx));
      };
      read();
      const mo = new MutationObserver(read);
      mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
      return () => mo.disconnect();
    }, [rootRef]);

    const folding = visibleCount < total;
    const budget = folding ? Math.max(0, Math.min(visibleCount, total)) : total;
    // Keep the selected tab visible: if it would fold, spend a leading slot on it.
    const activeBeyond = folding && activeIndex >= budget;
    const shownLeading = activeBeyond ? Math.max(0, budget - 1) : budget;
    const isVisible = (i: number) => !folding || i < shownLeading || i === activeIndex;
    const foldedIdx = tabEls.map((_, i) => i).filter((i) => !isVisible(i));

    const selectTab = (i: number) => {
      // Clicking the (hidden) real tab drives Base UI's own selection — no
      // controlled value or private context needed. Pin it optimistically so it
      // is already visible on the next render (no flash before the observer fires).
      rootRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[i]?.click();
      setActiveIndex(i);
    };

    const labelOf = (el: TabElement) => el.props.children;
    const textOf = (el: TabElement) =>
      typeof el.props.children === "string" ? el.props.children : undefined;

    return (
      <div className={styles.overflowWrap}>
        {/* Hidden, inert clone at the real row's width — measured for the cut. */}
        <div
          ref={ghostRef}
          className={cx(styles.list, styles.overflowList, styles.ghost)}
          aria-hidden
          inert
        >
          {tabEls.map((el, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional measurement stand-ins
            <span key={i} data-overflow-item className={styles.tab}>
              <span className={styles.label} data-text={textOf(el)}>
                {labelOf(el)}
              </span>
            </span>
          ))}
          <span
            data-overflow-trigger
            className={cx(styles.tab, styles.trigger, styles.ghostTrigger)}
          >
            <OverflowIcon />
          </span>
        </div>
        <BaseTabs.List
          {...rest}
          ref={mergeRefs(rootRef, ref)}
          className={mergeClassName(cx(styles.list, styles.overflowList), className)}
        >
          {tabEls.map((el, i) =>
            cloneElement(el, {
              style: { ...el.props.style, display: isVisible(i) ? undefined : "none" },
            }),
          )}
          {otherEls}
          {folding && foldedIdx.length > 0 && (
            <Menu.Root>
              <Menu.Trigger className={cx(styles.tab, styles.trigger)} aria-label={menuLabel}>
                <OverflowIcon />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="bottom" align="end" sideOffset={4}>
                  <Menu.Popup>
                    {foldedIdx.map((i) => (
                      <Menu.Item key={i} onClick={() => selectTab(i)}>
                        {labelOf(tabEls[i] as TabElement)}
                      </Menu.Item>
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          )}
        </BaseTabs.List>
      </div>
    );
  },
);

export const Tabs = { Root, List, Tab, Indicator, Panel };
