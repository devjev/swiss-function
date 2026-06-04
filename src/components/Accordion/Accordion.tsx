import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import styles from "./Accordion.module.css";

const Root = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseAccordion.Root>>(
  function AccordionRoot({ className, ...rest }, ref) {
    return (
      <BaseAccordion.Root {...rest} ref={ref} className={mergeClassName(styles.root, className)} />
    );
  },
);

const Item = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseAccordion.Item>>(
  function AccordionItem({ className, ...rest }, ref) {
    return (
      <BaseAccordion.Item {...rest} ref={ref} className={mergeClassName(styles.item, className)} />
    );
  },
);

const Header = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof BaseAccordion.Header>
>(function AccordionHeader({ className, ...rest }, ref) {
  return (
    <BaseAccordion.Header
      {...rest}
      ref={ref}
      className={mergeClassName(styles.header, className)}
    />
  );
});

const Trigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof BaseAccordion.Trigger>
>(function AccordionTrigger({ className, children, ...rest }, ref) {
  return (
    <BaseAccordion.Trigger
      {...rest}
      ref={ref}
      className={mergeClassName(styles.trigger, className)}
    >
      <span className={styles.label}>{children}</span>
      {/* SVG triangle — same geometry as src/lib/TreeChevron, inlined because
          TreeChevron renders a <button> and we can't nest it inside the
          Trigger button. Default orientation is "down" (= open); CSS rotates
          it -90deg (= right-pointing ▸) when the panel is closed. */}
      <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" className={styles.icon}>
        <path d="M1.5 3.5 L5 7 L8.5 3.5 Z" fill="currentColor" />
      </svg>
    </BaseAccordion.Trigger>
  );
});

const Panel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseAccordion.Panel>>(
  function AccordionPanel({ className, children, ...rest }, ref) {
    return (
      <BaseAccordion.Panel {...rest} ref={ref} className={mergeClassName(styles.panel, className)}>
        <div className={styles.panelInner}>{children}</div>
      </BaseAccordion.Panel>
    );
  },
);

export const Accordion = { Root, Item, Header, Trigger, Panel };
