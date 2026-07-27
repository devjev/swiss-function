/**
 * Imperative machinery behind `PopOut` (issue #84): open a same-origin child
 * browser window, seed its document, and keep its stylesheets and theme in
 * lockstep with the opener for as long as it lives.
 *
 * The child is a blank same-origin document (a `window.open("about:blank")`
 * popup, or a chromeless Document Picture-in-Picture window), so the opener
 * owns it. Styles
 * reach the opener as consumer-bundled `<style>`/`<link>` tags (Vite dev
 * injects per module and rewrites text on HMR; the built library's
 * `libInjectCss` side-effect imports add tags when a lazy chunk first runs),
 * so the sync must both copy what exists at open time and mirror later
 * additions, removals, and in-place text rewrites.
 */

/** Marks every node this module adds to the child head, so a reused window
 *  can be wiped clean before re-seeding. */
const CLONE_ATTR = "data-sf-popout-clone";

const STYLE_SELECTOR = 'style, link[rel="stylesheet"]';

export interface PopOutRect {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

/** Translate a client-coordinate rect into a `window.open` features string.
 *  Best-effort: `screenX/screenY` place the popup relative to the opener and
 *  the outer/inner height difference approximates the browser chrome above
 *  the viewport. Browsers clamp freely. */
export function buildFeatures(rect: PopOutRect | undefined, opener: Window): string {
  const parts = ["popup=yes"];
  if (rect) {
    const chromeHeight = Math.max(0, opener.outerHeight - opener.innerHeight);
    if (rect.width != null) parts.push(`width=${Math.round(rect.width)}`);
    if (rect.height != null) parts.push(`height=${Math.round(rect.height)}`);
    if (rect.left != null) parts.push(`left=${Math.round(opener.screenX + rect.left)}`);
    if (rect.top != null) parts.push(`top=${Math.round(opener.screenY + chromeHeight + rect.top)}`);
  }
  return parts.join(",");
}

/** Open (or refocus, when `name` matches a live popup) the child window.
 *  Returns `null` when a popup blocker refuses. Must be called within the
 *  task of a user gesture or blockers will refuse it. */
export function openChildWindow(opts: { name: string; features: string }): Window | null {
  return window.open("about:blank", opts.name, opts.features);
}

/** The Document Picture-in-Picture API (Chromium-only) opens a **chromeless**
 *  window: no address bar, no tab strip, always on top. `window.open` can't
 *  hide its address bar (browsers ignore the `location=no` feature), so this
 *  is the only way to drop the `about:blank` chrome. Secure-context only. */
interface DocumentPipWindowOptions {
  width?: number;
  height?: number;
}
interface DocumentPip {
  requestWindow(options?: DocumentPipWindowOptions): Promise<Window>;
  readonly window: Window | null;
}
function documentPip(): DocumentPip | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
}

/** Whether the browser supports a chromeless Picture-in-Picture window. */
export function supportsPip(): boolean {
  return typeof window !== "undefined" && documentPip() != null;
}

/** Open a chromeless Picture-in-Picture window. Must be called in a user
 *  gesture. Rejects if unsupported or refused. Only one such window can exist
 *  at a time — opening a second closes the first. */
export function openPipWindow(opts: { width?: number; height?: number }): Promise<Window> {
  const pip = documentPip();
  if (!pip) return Promise.reject(new Error("Document Picture-in-Picture is not supported"));
  const options: DocumentPipWindowOptions = {};
  if (opts.width != null) options.width = Math.round(opts.width);
  if (opts.height != null) options.height = Math.round(opts.height);
  return pip.requestWindow(options);
}

/** Seed a fresh (or reused) child document: charset + viewport meta, title,
 *  and an anti-flash background so a dark-themed opener does not spawn a
 *  white window before the cloned stylesheets land. The inline background
 *  reads `var(--sf-color-bg)` with the opener's *computed* color as the
 *  fallback, so it paints correctly immediately and tracks the theme once
 *  the tokens arrive. */
export function prepareChildDocument(child: Document, opener: Document, title: string): void {
  for (const stale of child.head.querySelectorAll(`[${CLONE_ATTR}]`)) stale.remove();

  const charset = child.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  charset.setAttribute(CLONE_ATTR, "");
  child.head.appendChild(charset);

  const viewport = child.createElement("meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  viewport.setAttribute(CLONE_ATTR, "");
  child.head.appendChild(viewport);

  child.title = title;

  const openerRoot = opener.defaultView?.getComputedStyle(opener.documentElement);
  const openerBody = opener.body && opener.defaultView?.getComputedStyle(opener.body);
  const literalBg =
    [openerBody?.backgroundColor, openerRoot?.backgroundColor].find(
      (c) => c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent",
    ) ?? "";
  child.documentElement.style.backgroundColor = literalBg
    ? `var(--sf-color-bg, ${literalBg})`
    : "var(--sf-color-bg)";
  child.documentElement.style.color = "var(--sf-color-fg)";
  child.body.style.margin = "0";
}

/** Clone every `<style>` and `<link rel="stylesheet">` from the opener head
 *  into the child head, then mirror additions, removals, and in-place
 *  `<style>` text rewrites (Vite HMR) until the returned cleanup runs.
 *  Constructable `adoptedStyleSheets` cannot cross documents; they are
 *  serialized to text once, with no live sync. */
export function syncStyles(opener: Document, child: Document): () => void {
  const clones = new Map<Element, Element>();

  const reconcile = () => {
    const seen = new Set<Element>();
    for (const source of opener.head.querySelectorAll(STYLE_SELECTOR)) {
      seen.add(source);
      const existing = clones.get(source);
      if (!existing) {
        const clone = child.importNode(source, true) as Element;
        // The href property is the absolute URL; the attribute may be
        // relative to the opener's base, which the child does not share.
        if (source instanceof HTMLLinkElement) clone.setAttribute("href", source.href);
        clone.setAttribute(CLONE_ATTR, "");
        clones.set(source, clone);
        child.head.appendChild(clone);
      } else if (source.tagName === "STYLE" && existing.textContent !== source.textContent) {
        existing.textContent = source.textContent;
      }
    }
    for (const [source, clone] of clones) {
      if (!seen.has(source)) {
        clone.remove();
        clones.delete(source);
      }
    }
  };

  reconcile();
  copyAdoptedSheets(opener, child);

  const observer = new MutationObserver(reconcile);
  observer.observe(opener.head, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    clones.clear();
  };
}

function copyAdoptedSheets(opener: Document, child: Document): void {
  const sheets = opener.adoptedStyleSheets;
  if (!sheets || sheets.length === 0) return;
  try {
    const text = sheets
      .map((sheet) =>
        Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n"),
      )
      .join("\n");
    const style = child.createElement("style");
    style.setAttribute(CLONE_ATTR, "adopted");
    style.textContent = text;
    child.head.appendChild(style);
  } catch {
    // Reading cssRules can throw on cross-origin sheets; skip them.
  }
}

/** Mirror the opener's root (`<html>`) attributes onto the child root, live,
 *  until the returned cleanup runs. Apps carry the active theme/palette on the
 *  root as attributes (`data-theme`, `data-colors`,
 *  ...) or classes, and the cloned stylesheets key on them, so the whole root
 *  attribute/class set is mirrored, not just `data-theme`. `style` is skipped
 *  so the child keeps its anti-flash inline background; the inline
 *  `color-scheme` (native controls/scrollbars) is mirrored on its own. */
export function syncRootAttributes(opener: Document, child: Document): () => void {
  let managed = new Set<string>();
  const apply = () => {
    const src = opener.documentElement;
    const dst = child.documentElement;
    const next = new Set<string>();
    for (const attr of Array.from(src.attributes)) {
      // Keep the child's own inline style (its anti-flash background/color).
      if (attr.name === "style") continue;
      next.add(attr.name);
      if (dst.getAttribute(attr.name) !== attr.value) dst.setAttribute(attr.name, attr.value);
    }
    // Drop attributes we set on a previous pass that the opener no longer has.
    for (const name of managed) {
      if (!next.has(name)) dst.removeAttribute(name);
    }
    managed = next;
    // color-scheme drives native form controls and scrollbars; mirror the
    // inline value (or the computed one) so they match the popup's theme.
    const inline = src.style.colorScheme;
    const scheme = inline || opener.defaultView?.getComputedStyle(src).colorScheme || "";
    if (dst.style.colorScheme !== scheme) dst.style.colorScheme = scheme;
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(opener.documentElement, { attributes: true });
  return () => observer.disconnect();
}

/** Report once when the child window is actually closed. `pagehide` also
 *  fires on in-window navigation, so it only confirms after a beat; a
 *  500ms `closed` poll backstops browsers where `pagehide` never arrives.
 *  The returned cleanup stops watching without firing (for when the opener
 *  closes the child itself). */
export function watchChildClosed(child: Window, onClosed: () => void): () => void {
  let done = false;
  let interval = 0;

  const stop = () => {
    done = true;
    window.clearInterval(interval);
    try {
      child.removeEventListener("pagehide", onPageHide);
    } catch {
      // The window may already be gone; nothing to detach.
    }
  };
  const fire = () => {
    if (done) return;
    stop();
    onClosed();
  };
  const onPageHide = () => {
    window.setTimeout(() => {
      if (child.closed) fire();
    }, 0);
  };

  child.addEventListener("pagehide", onPageHide);
  interval = window.setInterval(() => {
    if (child.closed) fire();
  }, 500);
  return stop;
}
