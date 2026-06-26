import type { ComponentPropsWithoutRef, HTMLAttributes, ReactElement, ReactNode } from "react";
import { Children, Fragment, forwardRef, isValidElement } from "react";
import { cx } from "../../lib/cx";
import { useCollapse } from "../../lib/useCollapse";
import { Accordion } from "../Accordion";
import { Tabs } from "../Tabs";
import styles from "./Reflow.module.css";

function toUnit(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

// --- Column (data carrier; never rendered directly — Root projects it) ---

export interface ReflowColumnProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Section / tab label shown in every state. */
  title: ReactNode;
  /** Stable id; falls back to the column index. Pass it to keep open/active
   *  state correct when columns are conditionally rendered. */
  value?: string;
  children?: ReactNode;
}

// Returns null: a Column only carries data for Root to read. Rendering one
// outside a Reflow.Root produces nothing (documented constraint).
function Column(_props: ReflowColumnProps): null {
  return null;
}

// Collect Column children, transparently flattening fragments (so consumers can
// group columns in a <>…</> or build them from a mapped array).
function collectColumns(children: ReactNode): ReactElement<ReflowColumnProps>[] {
  const out: ReactElement<ReflowColumnProps>[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      out.push(...collectColumns((child.props as { children?: ReactNode }).children));
    } else if (child.type === Column) {
      out.push(child as ReactElement<ReflowColumnProps>);
    }
  });
  return out;
}

// --- Root ----------------------------------------------------------------

interface ReflowBaseProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  /** Collapse threshold; `number` → `--sf-unit` multiples. Default `32`. */
  collapseAt?: number | string;
  /** Wide-state column gap; `number` → `--sf-unit` multiples. Default `1`. */
  gap?: number | string;
  /** Heading tag for the wide-state column titles. Default `3`. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
}

/** Narrow state = vertical accordion (default). `value` is an array. */
export interface ReflowAccordionProps extends ReflowBaseProps {
  collapseMode?: "accordion";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Allow more than one section open at once. */
  openMultiple?: boolean;
}

/** Narrow state = tab switcher. `value` is a single id. */
export interface ReflowTabsProps extends ReflowBaseProps {
  collapseMode: "tabs";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export type ReflowRootProps = ReflowAccordionProps | ReflowTabsProps;

// Internal flat view so we can read every mode field with one cast.
interface ReflowAllProps extends ReflowBaseProps {
  collapseMode?: "accordion" | "tabs";
  value?: string[] | string;
  defaultValue?: string[] | string;
  onValueChange?: (value: string[] | string) => void;
  openMultiple?: boolean;
}

type AccordionRootProps = ComponentPropsWithoutRef<typeof Accordion.Root>;
type TabsRootProps = ComponentPropsWithoutRef<typeof Tabs.Root>;

const HEADING_TAGS = ["h2", "h3", "h4", "h5", "h6"] as const;

const Root = forwardRef<HTMLDivElement, ReflowRootProps>(function ReflowRoot(props, ref) {
  const {
    collapseAt,
    gap = 1,
    headingLevel = 3,
    collapseMode = "accordion",
    value,
    defaultValue,
    onValueChange,
    openMultiple,
    className,
    children,
    ...rest
  } = props as unknown as ReflowAllProps;

  const { ref: collapseRef, collapsed } = useCollapse<HTMLDivElement>({ collapseAt });

  const columns = collectColumns(children);
  const idOf = (col: ReactElement<ReflowColumnProps>, i: number) => col.props.value ?? String(i);
  const firstColumn = columns[0];
  const firstId = firstColumn ? idOf(firstColumn, 0) : undefined;

  const setRef = (node: HTMLDivElement | null) => {
    collapseRef(node);
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
  };

  let inner: ReactNode;

  if (!collapsed) {
    // Wide: equal-width grid; each column gets a real heading + body.
    const Heading = HEADING_TAGS[headingLevel - 2] ?? "h3";
    inner = (
      <div
        className={styles.grid}
        style={{
          gridTemplateColumns: `repeat(${columns.length || 1}, minmax(0, 1fr))`,
          gap: toUnit(gap),
        }}
      >
        {columns.map((col, i) => {
          const {
            title,
            value: _v,
            children: colChildren,
            className: colCls,
            ...colRest
          } = col.props;
          return (
            <div key={idOf(col, i)} className={cx(styles.column, colCls)} {...colRest}>
              <Heading className={styles.heading}>{title}</Heading>
              <div className={styles.body}>{colChildren}</div>
            </div>
          );
        })}
      </div>
    );
  } else if (collapseMode === "tabs") {
    // Narrow + tabs: reuse Tabs; one panel shown at a time.
    const tabsDefault = (
      value === undefined ? (defaultValue ?? firstId) : undefined
    ) as TabsRootProps["defaultValue"];
    inner = (
      <Tabs.Root
        value={value as TabsRootProps["value"]}
        defaultValue={tabsDefault}
        onValueChange={onValueChange as TabsRootProps["onValueChange"]}
      >
        <Tabs.List>
          {columns.map((col, i) => (
            <Tabs.Tab key={idOf(col, i)} value={idOf(col, i)}>
              {col.props.title}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator />
        </Tabs.List>
        {columns.map((col, i) => (
          <Tabs.Panel key={idOf(col, i)} value={idOf(col, i)}>
            {col.props.children}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    );
  } else {
    // Narrow + accordion: reuse Accordion; default to the first section open.
    const accordionDefault = (
      value === undefined ? (defaultValue ?? (firstId ? [firstId] : [])) : undefined
    ) as AccordionRootProps["defaultValue"];
    inner = (
      <Accordion.Root
        value={value as AccordionRootProps["value"]}
        defaultValue={accordionDefault}
        onValueChange={onValueChange as AccordionRootProps["onValueChange"]}
        multiple={openMultiple}
      >
        {columns.map((col, i) => (
          <Accordion.Item key={idOf(col, i)} value={idOf(col, i)}>
            <Accordion.Header>
              <Accordion.Trigger>{col.props.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{col.props.children}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    );
  }

  return (
    <div ref={setRef} className={cx(styles.root, className)} {...rest}>
      {inner}
    </div>
  );
});

export const Reflow = { Root, Column };
