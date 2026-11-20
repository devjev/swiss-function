// Block types for the Outliner that the app wires to an engine of its own:
// a query, math, a diagram, a data table, a code editor, a link preview.
//
// Each `create...BlockType` returns an `OutlinerBlockType` for the Outliner's
// `blockTypes` prop. The library ships no Mermaid, no search index and makes
// no network call: the app passes the function that does the work, the way
// `Notebook` takes its SQL executor. Math is the exception: KaTeX is a
// dependency, loaded when the first formula renders.
//
// They live in an entry of their own (`/outliner-blocks`), so an outline that
// registers none of them carries neither `DataTable` nor `CodeEditor`.

import type { Extension } from "@codemirror/state";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { measureCssLength } from "../../lib/useCssPx";
import { CodeEditor } from "../CodeEditor";
import { DataTable, type LeafColumnDef } from "../DataTable";
import {
  fenceBody,
  fenceSource,
  type OutlinerBlockProps,
  type OutlinerBlockType,
  type OutlinerValue,
  useOutlinerTree,
} from "../Outliner";
import { plainLabel } from "../Outliner/zoom";
import { parseData, type QueryResult } from "./data";
import styles from "./OutlinerBlocks.module.css";

// ----------------------------------------------------------------------------
// A value that may arrive later
// ----------------------------------------------------------------------------

type Resolved<T> =
  | { status: "pending" }
  | { status: "done"; value: T }
  | { status: "failed"; message: string };

/** Run `work` now and whenever `deps` change; an answer to an earlier run is
 *  dropped. A plain value settles in the same render. */
function useResolved<T>(work: () => T | Promise<T>, deps: readonly unknown[]): Resolved<T> {
  const [state, setState] = useState<{ deps: readonly unknown[]; result: Resolved<T> } | null>(
    null,
  );
  const fresh = state !== null && sameDeps(state.deps, deps);
  useEffect(() => {
    let live = true;
    const settle = (result: Resolved<T>) => {
      if (live) setState({ deps, result });
    };
    try {
      const out = work();
      if (out instanceof Promise) {
        out.then(
          (value) => settle({ status: "done", value }),
          (error) => settle({ status: "failed", message: messageOf(error) }),
        );
      } else settle({ status: "done", value: out });
    } catch (error) {
      settle({ status: "failed", message: messageOf(error) });
    }
    return () => {
      live = false;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: the caller's deps say when `work` runs again
  }, deps);
  return fresh ? state.result : { status: "pending" };
}

/** `value`, once it has stopped changing for `delay` milliseconds. The first
 *  value is there at once; 0 passes every value straight through. */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (delay <= 0) return;
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return delay <= 0 ? value : settled;
}

const sameDeps = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function Failure({ what, message }: { what: string; message: string }) {
  return (
    <div className={styles.error} role="alert">
      {what}: {message}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Query: `{{query words}}`
// ----------------------------------------------------------------------------

export interface QueryBlockOptions {
  /** Find the blocks for a query. `tree` is the outline the block sits in;
   *  the query runs again when it changes. `searchBlocks` is a plain text
   *  search over that tree. */
  run: (query: string, tree: OutlinerValue) => QueryResult[] | Promise<QueryResult[]>;
  /** How long the tree must stay unchanged before the query runs again, in
   *  milliseconds: typing elsewhere in the outline does not run it per
   *  keystroke. A changed query runs at once. Default 200; 0 runs on every
   *  change. */
  debounce?: number;
  /** The word in `{{name ...}}`. Default `"query"`. */
  name?: string;
  /** A result was clicked. The outline puts the caret in the block when it is
   *  in this tree; this is for the ones that are elsewhere. */
  onOpen?: (result: QueryResult) => void;
}

export function createQueryBlockType(options: QueryBlockOptions): OutlinerBlockType {
  const name = options.name ?? "query";
  return {
    name,
    command: { label: "Query", description: "The blocks that match", insert: `{{${name} }}` },
    render: (props) => <QueryBlock {...props} options={options} />,
  };
}

function QueryBlock({
  source,
  edit,
  options,
}: OutlinerBlockProps & { options: QueryBlockOptions }) {
  const tree = useSettled(useOutlinerTree(), options.debounce ?? 200);
  const query = source.trim();
  const found = useResolved(() => options.run(query, tree), [query, tree, options]);
  // The last answer stays up while the next one is on its way.
  const [shown, setShown] = useState<QueryResult[] | null>(null);
  useEffect(() => {
    if (found.status === "done") setShown(found.value);
  }, [found]);
  if (found.status === "failed") return <Failure what="Query" message={found.message} />;
  const results = found.status === "done" ? found.value : shown;
  return (
    <div className={styles.query}>
      <div className={styles.queryHead}>
        <span>{query || "Empty query"}</span>
        <span className={styles.count}>{results ? results.length : "…"}</span>
      </div>
      {results?.map((result) => (
        <button
          key={result.id}
          type="button"
          className={styles.result}
          // The outline is one tab stop; the results are a pointer shortcut.
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            edit(result.id);
            options.onOpen?.(result);
          }}
        >
          <span className={styles.resultText}>{plainLabel(result.content) || "Empty block"}</span>
          {result.path && <span className={styles.resultPath}>{result.path}</span>}
        </button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Math (`$$ ... $$`) and diagrams (a fenced block): markup from the app
// ----------------------------------------------------------------------------

/** What each renderer returned for a source, so a block that renders again
 *  (it was edited and left, it scrolled back into a virtualized outline) shows
 *  its markup at once instead of going through "pending". */
const MARKUP = new WeakMap<object, Map<string, string>>();
const MARKUP_LIMIT = 400;

function remember(render: object, key: string, markup: string): string {
  let known = MARKUP.get(render);
  if (!known) {
    known = new Map();
    MARKUP.set(render, known);
  }
  // The oldest entry makes room.
  if (known.size >= MARKUP_LIMIT) known.delete(known.keys().next().value as string);
  known.set(key, markup);
  return markup;
}

/** Markup from a renderer, put into the page as it is. The renderer is
 *  trusted with that: KaTeX and Mermaid both escape what they are given
 *  (keep KaTeX's `trust` off and Mermaid's `securityLevel` strict). */
function Rendered({
  what,
  source,
  render,
  inline = false,
}: {
  what: string;
  source: string;
  render: (source: string, display: boolean) => string | Promise<string>;
  /** A span in a line of text instead of a block. */
  inline?: boolean;
}) {
  const key = `${inline ? "i" : "d"}:${source}`;
  const known = MARKUP.get(render)?.get(key);
  const resolved = useResolved(
    () =>
      known ?? Promise.resolve(render(source, !inline)).then((out) => remember(render, key, out)),
    [key, render],
  );
  const markup: Resolved<string> =
    known !== undefined ? { status: "done", value: known } : resolved;
  if (inline) {
    // In a line of text the source stands in until the markup is there, and
    // stays, marked, when the renderer refuses it.
    if (markup.status !== "done") {
      const failed = markup.status === "failed";
      return (
        <span
          className={failed ? styles.inlineError : undefined}
          title={failed ? markup.message : undefined}
        >
          {source}
        </span>
      );
    }
    return <InlineMarkup markup={markup.value} />;
  }
  if (markup.status === "failed") return <Failure what={what} message={markup.message} />;
  if (markup.status === "pending") return <span className={styles.status}>{what}…</span>;
  return <Snapped markup={markup.value} />;
}

/** The smallest length the layout keeps: margins are set in whole steps, so
 *  what is asked for is what is laid out. */
const STEP = 1 / 64;

/** Fit a formula into its line of text. One no taller than the line stays an
 *  ordinary inline span, which may break across lines. A taller one (a
 *  fraction) becomes one box, and its margins say how much of it the line
 *  counts. A little overflow is let into the neighbours' leading and the line
 *  keeps its height: an eighth of a unit above, where the line before has its
 *  descenders, and a quarter below, where the next line's letters start
 *  lower. Past that the line takes whole units more, the formula in the
 *  middle. The text's baseline does not move. */
function fitInline(element: HTMLElement) {
  const probe = element.firstElementChild;
  if (!probe) return;
  const style = element.style;
  // Measured as one box, without what an earlier fit set.
  style.display = "inline-block";
  style.marginBlock = "0";
  const box = element.getBoundingClientRect();
  // The probe is an empty span in the text's font: its box is the font's
  // content area, and the line's own height is centred on that.
  const area = probe.getBoundingClientRect();
  const centre = (area.top + area.bottom) / 2;
  const line = Number.parseFloat(getComputedStyle(element).lineHeight) || area.height;
  const above = centre - box.top - line / 2;
  const below = box.bottom - centre - line / 2;
  if (above <= STEP && below <= STEP) {
    style.display = "";
    style.marginBlock = "";
    return;
  }
  const unit = measureCssLength(element, "var(--sf-unit)") || line;
  const over = Math.max(above - unit / 8, below - unit / 4);
  const more = Math.max(0, Math.ceil((2 * over) / unit));
  const half = (line + more * unit) / 2;
  const steps = (length: number) => Math.floor(length / STEP) * STEP;
  const top = steps(box.top - (centre - half));
  if (more === 0) {
    // Just inside the line's own height, which then is the line's height.
    style.marginTop = `${top - STEP}px`;
    style.marginBottom = `${steps(centre + half - box.bottom) - STEP}px`;
  } else {
    // The margin box is the line's height to the step.
    style.marginTop = `${top}px`;
    style.marginBottom = `${line + more * unit - box.height - top}px`;
  }
}

/** A renderer's markup inside a line of text. */
function InlineMarkup({ markup }: { markup: string }) {
  const outer = useRef<HTMLSpanElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: new markup is a new formula to fit
  useLayoutEffect(() => {
    const element = outer.current;
    if (!element) return;
    const refit = () => fitInline(element);
    refit();
    // The formula's fonts arrive after it: its size changes with them.
    const fonts = element.ownerDocument.fonts;
    fonts?.addEventListener("loadingdone", refit);
    return () => fonts?.removeEventListener("loadingdone", refit);
  }, [markup]);
  return (
    <span ref={outer} className={styles.inline}>
      <span aria-hidden="true" />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the output of the renderer the app passed in */}
      <span dangerouslySetInnerHTML={{ __html: markup }} />
    </span>
  );
}

/** A renderer's markup as a block. Its height is whatever the formula or the
 *  drawing needs, so the block around it takes the next whole number of units
 *  (`round()` in the stylesheet, from the height measured here). */
function Snapped({ markup }: { markup: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className={styles.rendered}
      style={{ "--sf-rendered-size": `${height}px` } as CSSProperties}
    >
      <div
        ref={inner}
        className={styles.markup}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the output of the renderer the app passed in
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}

export interface MathBlockOptions {
  /** TeX to markup; `display` is true for a block and false for a formula
   *  inside a line. Default: KaTeX, loaded with its stylesheet when the first
   *  formula renders. */
  render?: (tex: string, display: boolean) => string | Promise<string>;
  /** Also render `$x$` inside a block's text. Default true. */
  inline?: boolean;
}

let katex: Promise<typeof import("katex")> | undefined;

/** KaTeX with its defaults: `trust` off, and an error for TeX it cannot
 *  parse, which the block shows. Its stylesheet comes with it, the way `Map`
 *  brings MapLibre's: both resolve against the installed package. */
function renderKatex(tex: string, display: boolean): Promise<string> {
  katex ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(
    ([module]) => module,
  );
  return katex.then((module) =>
    module.default.renderToString(tex, { displayMode: display, throwOnError: true }),
  );
}

const MATH = /^\$\$([\s\S]+)\$\$$/;

/** A block that is `$$ ... $$` and nothing else, and `$x$` inside the text of
 *  any block. */
export function createMathBlockType(options: MathBlockOptions = {}): OutlinerBlockType {
  const render = options.render ?? renderKatex;
  return {
    name: "math",
    match: (content) => MATH.exec(content.trim())?.[1]?.trim() ?? null,
    command: { label: "Math", description: "$$ … $$", insert: "$$  $$" },
    render: ({ source }) => <Rendered what="Math" source={source} render={render} />,
    inline:
      options.inline === false
        ? undefined
        : {
            open: "$",
            render: (source) => <Rendered what="Math" source={source} render={render} inline />,
          },
  };
}

export interface DiagramBlockOptions {
  /** Diagram source to SVG markup, for example
   *  `async (source) => (await mermaid.render(id, source)).svg`. */
  render: (source: string) => string | Promise<string>;
  /** The fence's language. Default `"mermaid"`. */
  name?: string;
  aliases?: string[];
}

/** A fenced block in the diagram's language. */
export function createDiagramBlockType(options: DiagramBlockOptions): OutlinerBlockType {
  const name = options.name ?? "mermaid";
  return {
    name,
    aliases: options.aliases,
    match: "fence",
    command: { label: "Diagram", description: `A ${name} block`, insert: fenceSource(name, "") },
    render: ({ source }) => <Rendered what="Diagram" source={source} render={options.render} />,
  };
}

// ----------------------------------------------------------------------------
// Data: a fenced `csv`, `tsv` or `json` block as a DataTable
// ----------------------------------------------------------------------------

export interface DataBlockOptions {
  /** Rows shown before the table scrolls. Default 10. */
  maxRows?: number;
}

export function createDataBlockType(options: DataBlockOptions = {}): OutlinerBlockType {
  const maxRows = options.maxRows ?? 10;
  return {
    name: "csv",
    aliases: ["tsv", "json"],
    match: "fence",
    command: {
      label: "Data",
      description: "A csv block as a table",
      insert: fenceSource("csv", ""),
    },
    render: (props) => <DataBlock {...props} maxRows={maxRows} />,
  };
}

function DataBlock({ block, source, maxRows }: OutlinerBlockProps & { maxRows: number }) {
  const language = fenceBody(block.content)?.language ?? "csv";
  const parsed = useMemo(() => {
    try {
      return { table: parseData(language, source) };
    } catch (error) {
      return { message: messageOf(error) };
    }
  }, [language, source]);
  const table = parsed.table;
  const columns = useMemo<LeafColumnDef<Record<string, unknown>>[]>(
    () =>
      (table?.columns ?? []).map((name) => ({
        id: name,
        header: name,
        accessor: name,
        align: table?.numeric.has(name) ? "end" : undefined,
        cell: ({ value }) =>
          value !== null && typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
      })),
    [table],
  );
  if (!table) return <Failure what="Data" message={parsed.message ?? "no table"} />;
  // The header row and the body rows at the table's pitch, and its two borders.
  const rows = Math.min(table.rows.length, maxRows) + 1;
  return (
    <div
      className={styles.data}
      style={{ blockSize: `calc(var(--sf-unit) * ${rows * 1.25} + 2px)` }}
    >
      <DataTable data={table.rows} columns={columns} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Code: any fenced block, edited in a CodeEditor in place
// ----------------------------------------------------------------------------

export interface CodeBlockOptions {
  /** The CodeMirror extensions for a fence's language (`javascript()` for
   *  `js`). Return a stable array per language: a new one reconfigures the
   *  editor. No language package is bundled. */
  extensions?: (language: string) => Extension[] | undefined;
}

/** Takes over every fenced block that no type before it in `blockTypes`
 *  claims: put it last. */
export function createCodeBlockType(options: CodeBlockOptions = {}): OutlinerBlockType {
  return {
    name: "code",
    match: (content) => fenceBody(content)?.body ?? null,
    render: (props) => <CodeBlock {...props} options={options} />,
  };
}

function CodeBlock({
  block,
  source,
  readOnly,
  setContent,
  options,
}: OutlinerBlockProps & { options: CodeBlockOptions }) {
  const language = fenceBody(block.content)?.language ?? "";
  const extensions = useMemo(() => options.extensions?.(language), [options, language]);
  return (
    <CodeEditor
      value={source}
      readOnly={readOnly}
      extensions={extensions}
      aria-label={language ? `${language} code` : "Code"}
      onChange={(next) => {
        if (next !== source) setContent(fenceSource(language, next));
      }}
    />
  );
}

// ----------------------------------------------------------------------------
// Link preview: a block that is one URL
// ----------------------------------------------------------------------------

export interface LinkPreview {
  title?: string;
  description?: string;
  /** The site's name, shown under the description. The host when omitted. */
  site?: string;
  image?: string;
}

export interface LinkPreviewBlockOptions {
  /** What a page says about itself. The library makes no network call: this
   *  usually asks the app's own server. Null (or a rejection) leaves the block
   *  a plain link. */
  fetch: (url: string) => LinkPreview | null | Promise<LinkPreview | null>;
}

const URL_ONLY = /^https?:\/\/\S+$/;

export function createLinkPreviewBlockType(options: LinkPreviewBlockOptions): OutlinerBlockType {
  return {
    name: "link-preview",
    match: (content) => (URL_ONLY.test(content.trim()) ? content.trim() : null),
    render: ({ source }) => <LinkPreviewBlock url={source} options={options} />,
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function LinkPreviewBlock({ url, options }: { url: string; options: LinkPreviewBlockOptions }) {
  const preview = useResolved(() => options.fetch(url), [url, options]);
  const data = preview.status === "done" ? preview.value : null;
  const link = (children: ReactNode, className?: string) => (
    <a href={url} target="_blank" rel="noreferrer noopener" className={className}>
      {children}
    </a>
  );
  if (!data) return link(url);
  return link(
    <>
      <span className={styles.previewText}>
        <span className={styles.previewTitle}>{data.title || url}</span>
        {data.description && <span className={styles.previewDescription}>{data.description}</span>}
        <span className={styles.previewSite}>{data.site || hostOf(url)}</span>
      </span>
      {data.image && <img className={styles.previewImage} src={data.image} alt="" />}
    </>,
    styles.preview,
  );
}
