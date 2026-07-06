import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Tabs.module.css";

const Root = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.Root>>(
  function TabsRoot({ className, ...rest }, ref) {
    return <BaseTabs.Root {...rest} ref={ref} className={mergeClassName(styles.root, className)} />;
  },
);

const List = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseTabs.List>>(
  function TabsList({ className, ...rest }, ref) {
    return <BaseTabs.List {...rest} ref={ref} className={mergeClassName(styles.list, className)} />;
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

export const Tabs = { Root, List, Tab, Indicator, Panel };
