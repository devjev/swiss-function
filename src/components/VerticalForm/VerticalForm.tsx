/** VerticalForm — a tall, one-field-per-row form that scrolls and is navigated
 *  by a Minimap rail. It fills the gap between FieldLayout (justified, wrapping
 *  rows for horizontal density) and Form (state + validation): here every field
 *  gets its own row (a Box surface holding a vertical Field), the whole stack
 *  scrolls inside a component-owned container, and the field names (and section
 *  titles) become clickable markers on the rail.
 *
 *  It is presentational: layout and navigation only. Each row exposes an
 *  optional error slot, but form state, validation and submit stay with the
 *  consumer — wrap it in `Form` when you want those.
 *
 *  The only machinery beyond composition is turning rows into Minimap markers:
 *  each Section/Field registers its DOM node, and the Root measures each node's
 *  offset within the scroll content to build the `markers` array in content
 *  coordinates (re-supplying on resize), which is exactly Minimap's contract.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { prefersReducedMotion } from "../../lib/prefersReducedMotion";
import { Box, type BoxElevation } from "../Box";
import { Field } from "../Field";
import { Minimap, type MinimapMarker } from "../Minimap";
import { Picker } from "../Picker";
import styles from "./VerticalForm.module.css";

// --- Marker assembly (pure, unit-tested) ------------------------------------

export interface VerticalFormEntry {
  id: string;
  /** Offset from the top of the scroll content, in px (content coordinates). */
  top: number;
  /** The row's height in px, so it reads on the rail as a filled dither block
   *  (the density read), not a bare rule. */
  height: number;
  /** Rail label. A field/section with a non-string name has none, so it
   *  contributes a bare block span instead of a labeled one. */
  label?: string;
  /** Heading depth: sections are 1, their fields 2, ungrouped fields 1. */
  level: number;
  /** `"danger"` marks an errored field on the rail. */
  tone?: MinimapMarker["tone"];
  /** Section titles are emphasized (italic) on the rail; fields are not. */
  emphasis?: boolean;
}

/** Turn measured entries into Minimap markers: sort by position (Map insertion
 *  order is not DOM order). Every row is a filled dither `block` span of its
 *  own height; a named row is additionally a `header`, so its label rides on
 *  top of the block. */
export function buildMarkers(entries: VerticalFormEntry[]): MinimapMarker[] {
  return entries
    .slice()
    .sort((a, b) => a.top - b.top)
    .map((entry) => ({
      id: entry.id,
      top: entry.top,
      height: entry.height,
      kind: entry.label ? "header" : "block",
      label: entry.label,
      level: entry.level,
      tone: entry.tone,
      emphasis: entry.emphasis,
    }));
}

function sameMarkers(a: MinimapMarker[], b: MinimapMarker[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((m, i) => {
    const n = b[i];
    if (!n) return false;
    return (
      m.id === n.id &&
      m.top === n.top &&
      m.height === n.height &&
      m.kind === n.kind &&
      m.label === n.label &&
      m.level === n.level &&
      m.tone === n.tone &&
      m.emphasis === n.emphasis
    );
  });
}

// --- Title navigation (pure, unit-tested) -----------------------------------

/** A navigable title (section or field) with its measured content offset. */
export interface VerticalFormTitle {
  id: string;
  label: string;
  level: number;
  /** Offset from the top of the scroll content, in px. */
  top: number;
  /** The row's height in px, so a jump can center the row's middle. */
  height: number;
}

/** Figure space (U+2007): a digit-width space that indents nested titles in the
 *  nav Picker, whose item labels are plain text. */
const TITLE_INDENT = "  ";

/** Picker items for the title nav: one per title, fields indented under their
 *  section by level. */
export function buildTitleItems(
  titles: VerticalFormTitle[],
): Array<{ value: string; label: string }> {
  return titles.map((title) => ({
    value: title.id,
    label: TITLE_INDENT.repeat(Math.max(0, title.level - 1)) + title.label,
  }));
}

const TITLE_ACTIVE_EPSILON = 2;

/** Id of the title currently at (or last above) the viewport top, mirroring
 *  Minimap's active-heading rule: the last title with top <= scrollTop, with an
 *  at-bottom clamp so the final title wins once scrolled to the end. Titles must
 *  be sorted by top. Returns "" when there are none. */
export function activeTitleId(
  titles: VerticalFormTitle[],
  scrollTop: number,
  maxScroll: number,
  anchor = TITLE_ACTIVE_EPSILON,
): string {
  if (titles.length === 0) return "";
  // At rest the first title is active, so the nav is never empty and never a
  // mid-list title just because the anchor line sits below the top.
  if (scrollTop <= 1) return titles[0]?.id ?? "";
  if (maxScroll > 0 && scrollTop >= maxScroll - 1) {
    return titles[titles.length - 1]?.id ?? "";
  }
  // The last title at or above the anchor line (the viewport middle when jumps
  // center), defaulting to the first.
  let active = titles[0]?.id ?? "";
  for (const title of titles) {
    if (title.top <= scrollTop + anchor) active = title.id;
    else break;
  }
  return active;
}

// --- Context ----------------------------------------------------------------

interface EntryMeta {
  kind: "section" | "field";
  label?: string;
  level: number;
  tone?: MinimapMarker["tone"];
}

interface RegistryValue {
  register: (id: string, node: HTMLElement, meta: EntryMeta) => void;
  unregister: (id: string) => void;
}

const noop: RegistryValue = { register: () => {}, unregister: () => {} };
const RegistryContext = createContext<RegistryValue>(noop);
/** Nesting level for a Field's marker: 1 at the root, 2 inside a Section. */
const LevelContext = createContext<number>(1);
/** Default row elevation, set once on the Root, overridable per Field. */
const ElevationContext = createContext<BoxElevation>(1);

// --- Root -------------------------------------------------------------------

export interface VerticalFormProps extends HTMLAttributes<HTMLDivElement> {
  /** Default surface elevation for every row (0 flat to 5). Default `1`. */
  elevation?: BoxElevation;
  /** Which edge the Minimap rail occupies. Default `"right"`. */
  side?: "left" | "right";
  /** Minimap rail width in `--sf-unit` multiples. */
  minimapWidth?: number;
  /** Content padding in `--sf-unit` multiples. Default `1`. */
  padding?: number;
  /** Show a bottom navigation bar: a searchable Picker of every title (section
   *  and field). Selecting one scrolls to it; scrolling updates the Picker to
   *  the title at the top of the viewport. Default `false`. */
  nav?: boolean;
  /** Size of the nav bar Picker (mirrors `Input`/`Picker` sizes). Default `sm`. */
  navSize?: "sm" | "md" | "lg";
  /** Minimum rail block height per field, in `--sf-unit` multiples. Blocks never
   *  compress below this; a denser form scrolls its rail instead. Default `0.5`. */
  minBlock?: number;
  /** Maximum rail block height per field, in `--sf-unit` multiples. Caps how
   *  tall a block grows in a sparse form. Unset = no cap. */
  maxBlock?: number;
}

const Root = forwardRef<HTMLDivElement, VerticalFormProps>(function VerticalForm(
  {
    elevation = 1,
    side = "right",
    minimapWidth,
    padding = 1,
    nav = false,
    navSize = "sm",
    minBlock = 0.5,
    maxBlock,
    className,
    children,
    style,
    ...rest
  },
  forwardedRef,
) {
  const entriesRef = useRef<Map<string, { node: HTMLElement; meta: EntryMeta }>>(new Map());
  const contentRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [markers, setMarkers] = useState<MinimapMarker[]>([]);

  // Title nav state: the scroll element (also the forwarded ref target), the
  // measured titles (mirrored in a ref for the scroll listener), and the id of
  // the title at the viewport top (the Picker's value).
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const titlesRef = useRef<VerticalFormTitle[]>([]);
  const activeRafRef = useRef(0);
  const [activeId, setActiveId] = useState("");

  /** Read every registered node's offset within the scroll content and rebuild
   *  the marker array. Offsets are taken as (row top − content top), which is
   *  scroll-independent (both boxes move together) and equals the content-px
   *  coordinate Minimap expects. */
  const measure = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const base = content.getBoundingClientRect().top;
    const entries: VerticalFormEntry[] = [];
    entriesRef.current.forEach(({ node, meta }, id) => {
      const rect = node.getBoundingClientRect();
      entries.push({
        id,
        top: rect.top - base,
        height: rect.height,
        label: meta.label,
        level: meta.level,
        tone: meta.tone,
        emphasis: meta.kind === "section",
      });
    });
    const next = buildMarkers(entries);
    setMarkers((prev) => (sameMarkers(prev, next) ? prev : next));
  }, []);

  /** rAF-coalesce a measure so a burst of registrations or a resize collapses
   *  into one trailing frame (the Minimap idiom). */
  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /** Recompute the active title (Picker value) from the current scroll offset,
   *  rAF-coalesced like the measure path. */
  const recomputeActive = useCallback(() => {
    const el = scrollElRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    // Anchor on the viewport middle, matching the centered jump, so the title
    // scrolled to the centre is the one the nav shows.
    setActiveId(activeTitleId(titlesRef.current, el.scrollTop, maxScroll, el.clientHeight / 2));
  }, []);
  const scheduleActive = useCallback(() => {
    cancelAnimationFrame(activeRafRef.current);
    activeRafRef.current = requestAnimationFrame(recomputeActive);
  }, [recomputeActive]);
  useEffect(() => () => cancelAnimationFrame(activeRafRef.current), []);

  // Titles reuse the markers (already sorted by top, labelled ones are the
  // navigable titles); keep a ref mirror for the scroll listener.
  const titles = useMemo<VerticalFormTitle[]>(
    () =>
      markers
        .filter((m) => m.label != null)
        .map((m) => ({
          id: m.id ?? "",
          label: m.label ?? "",
          level: m.level ?? 1,
          top: m.top ?? 0,
          height: m.height ?? 0,
        })),
    [markers],
  );
  useEffect(() => {
    titlesRef.current = titles;
    scheduleActive();
  }, [titles, scheduleActive]);
  const titleItems = useMemo(() => buildTitleItems(titles), [titles]);

  const register = useCallback(
    (id: string, node: HTMLElement, meta: EntryMeta) => {
      entriesRef.current.set(id, { node, meta });
      schedule();
    },
    [schedule],
  );

  const unregister = useCallback(
    (id: string) => {
      entriesRef.current.delete(id);
      schedule();
    },
    [schedule],
  );

  const registry = useMemo<RegistryValue>(() => ({ register, unregister }), [register, unregister]);

  // The content wrapper carries its own ResizeObserver: a row growing (a
  // TextEdit expanding, an error line appearing) shifts every marker below it,
  // and the scroll element's border box does not change when content grows.
  const observerRef = useRef<ResizeObserver | null>(null);
  const setContentNode = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      contentRef.current = node;
      if (node && typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(schedule);
        observer.observe(node);
        observerRef.current = observer;
      }
      schedule();
    },
    [schedule],
  );

  // Capture the Minimap scroll element (which the ref forwards) so the nav can
  // scroll it and track the active title. The listener is attached only when
  // the nav is on.
  const scrollListenerCleanup = useRef<(() => void) | null>(null);
  const setScrollEl = useCallback(
    (node: HTMLDivElement | null) => {
      scrollListenerCleanup.current?.();
      scrollListenerCleanup.current = null;
      scrollElRef.current = node;
      if (node && nav) {
        node.addEventListener("scroll", scheduleActive, { passive: true });
        scrollListenerCleanup.current = () => node.removeEventListener("scroll", scheduleActive);
        scheduleActive();
      }
    },
    [nav, scheduleActive],
  );
  const setMinimapRef = useMemo(
    () => mergeRefs<HTMLDivElement>(setScrollEl, forwardedRef),
    [setScrollEl, forwardedRef],
  );

  const handleSelect = useCallback((selected: string) => {
    setActiveId(selected);
    const el = scrollElRef.current;
    const title = titlesRef.current.find((t) => t.id === selected);
    if (!el || !title) return;
    // Center the row's MIDDLE in the viewport. `el` is the Minimap scroll
    // element, which sits above the nav bar in the grid, so its clientHeight is
    // already the form's visible height (nav excluded); adding the row's own
    // half-height puts the row centre — not its top — on the centre line.
    // scrollTo clamps a negative top to 0.
    el.scrollTo({
      top: title.top + title.height / 2 - el.clientHeight / 2,
      behavior: prefersReducedMotion() ? "instant" : "smooth",
    });
  }, []);

  const minimap = (
    <Minimap
      ref={setMinimapRef}
      side={side}
      width={minimapWidth}
      markers={markers}
      minMarkerSize={minBlock}
      maxMarkerSize={maxBlock}
      jumpAlign="center"
      {...(nav ? {} : { ...rest, className, style })}
    >
      <div
        ref={setContentNode}
        className={styles.content}
        style={{ "--vf-pad": String(padding) } as CSSProperties}
      >
        {children}
      </div>
    </Minimap>
  );

  const body = nav ? (
    <div {...rest} className={cx(styles.root, className)} style={style}>
      {minimap}
      <div className={styles.navBar}>
        <Picker
          items={titleItems}
          value={activeId}
          onChange={handleSelect}
          placeholder="Jump to a field…"
          size={navSize}
        />
      </div>
    </div>
  ) : (
    minimap
  );

  return (
    <RegistryContext.Provider value={registry}>
      <ElevationContext.Provider value={elevation}>{body}</ElevationContext.Provider>
    </RegistryContext.Provider>
  );
});

// --- Section ----------------------------------------------------------------

export interface VerticalFormSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Section heading. A string name also becomes a level-1 rail label. */
  title: ReactNode;
  children?: ReactNode;
}

const Section = forwardRef<HTMLDivElement, VerticalFormSectionProps>(function VerticalFormSection(
  { title, className, children, ...rest },
  ref,
) {
  const id = useId();
  const { register, unregister } = useContext(RegistryContext);
  const titleRef = useRef<HTMLDivElement>(null);
  const setRefs = useMemo(() => mergeRefs<HTMLDivElement>(titleRef, ref), [ref]);
  const label = typeof title === "string" ? title : undefined;

  // Anchor the section marker to the title node, so a rail click lands the
  // title at the top. Re-register when the label changes.
  useLayoutEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    register(id, node, { kind: "section", label, level: 1 });
    return () => unregister(id);
  }, [id, register, unregister, label]);

  return (
    <div {...rest} className={cx(styles.section, className)}>
      <div ref={setRefs} className={styles.sectionTitle}>
        {title}
      </div>
      <LevelContext.Provider value={2}>{children}</LevelContext.Provider>
    </div>
  );
});

// --- Field ------------------------------------------------------------------

export interface VerticalFormFieldProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Field name, shown above the control. A string also becomes a rail label. */
  label: ReactNode;
  /** Supplementary copy below the control (full-strength fg, never grey). */
  description?: ReactNode;
  /** Error message below the control; also marks the row's rail tick danger. */
  error?: ReactNode;
  /** Show a `*` on the label. Visual only — add `required` to the control too
   *  for HTML validation. */
  required?: boolean;
  /** "Jump to this field" shortcut badge (see Field's `hotkey`). */
  hotkey?: string;
  /** Row surface elevation; overrides the form's default. */
  elevation?: BoxElevation;
  /** The control — an Input, DatePicker, Selector, TextEdit, … */
  children?: ReactNode;
}

const VerticalFormField = forwardRef<HTMLElement, VerticalFormFieldProps>(
  function VerticalFormField(
    { label, description, error, required, hotkey, elevation, className, children, ...rest },
    ref,
  ) {
    const id = useId();
    const { register, unregister } = useContext(RegistryContext);
    const level = useContext(LevelContext);
    const defaultElevation = useContext(ElevationContext);
    const boxRef = useRef<HTMLElement>(null);
    const setRefs = useMemo(() => mergeRefs<HTMLElement>(boxRef, ref), [ref]);

    const markerLabel = typeof label === "string" ? label : undefined;
    const tone: MinimapMarker["tone"] | undefined = error != null ? "danger" : undefined;

    // Anchor the field marker to its Box, and re-register when the label, nesting
    // level, or error state (rail tone) changes.
    useLayoutEffect(() => {
      const node = boxRef.current;
      if (!node) return;
      register(id, node, { kind: "field", label: markerLabel, level, tone });
      return () => unregister(id);
    }, [id, register, unregister, markerLabel, level, tone]);

    return (
      <Box
        {...rest}
        ref={setRefs}
        elevation={elevation ?? defaultElevation}
        className={cx(styles.row, className)}
      >
        <Field
          className={cx(styles.field, description != null && styles.hasDescription)}
          required={required}
          hotkey={hotkey}
        >
          <Field.Label className={styles.fieldLabel}>{label}</Field.Label>
          <div className={styles.fieldControl}>{children}</div>
          {description != null ? (
            <Field.Description className={styles.fieldDescription}>{description}</Field.Description>
          ) : null}
          {error != null ? (
            <Field.Error className={styles.fieldError} match>
              {error}
            </Field.Error>
          ) : null}
        </Field>
      </Box>
    );
  },
);

export const VerticalForm = Object.assign(Root, {
  Section,
  Field: VerticalFormField,
});
