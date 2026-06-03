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
  function TabsTab({ className, ...rest }, ref) {
    return <BaseTabs.Tab {...rest} ref={ref} className={mergeClassName(styles.tab, className)} />;
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
