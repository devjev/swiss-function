// The meeting point between a widget and its lazily loaded drag layer (issue
// #93). The widget renders every element itself and reports each one here by
// key; the layer, once loaded, binds dnd-kit's node setters to those elements
// and leaves its activator listeners for the widget's own handlers to call.
// The widget's tree is the same with or without the layer, so nothing in it
// remounts when the layer arrives. No dnd-kit import: the widget's static
// bundle stays free of it.

/** dnd-kit's `listeners`: activator handlers by React event prop name
 *  (`onPointerDown`, `onTouchStart`). */
export type DragListeners = Readonly<Record<string, unknown>>;

export class DragNodes {
  private readonly elements = new Map<string, HTMLElement>();
  private readonly sinks = new Map<string, (el: HTMLElement | null) => void>();
  private readonly handlers = new Map<string, DragListeners>();

  /** Widget side: the element for `key` mounted (`el`) or unmounted (`null`).
   *  Call it from the element's ref. */
  attach(key: string, el: HTMLElement | null): void {
    if (el) this.elements.set(key, el);
    else this.elements.delete(key);
    this.sinks.get(key)?.(el);
  }

  /** Layer side: hand `key`'s element, now and whenever it changes, to `sink`
   *  (dnd-kit's `setNodeRef`). The returned function ends the binding and
   *  hands the sink `null`. */
  bind(key: string, sink: (el: HTMLElement | null) => void): () => void {
    this.sinks.set(key, sink);
    sink(this.elements.get(key) ?? null);
    return () => {
      if (this.sinks.get(key) === sink) this.sinks.delete(key);
      sink(null);
    };
  }

  /** Layer side: the activator listeners for `key`, or `undefined` to drop them
   *  (a disabled draggable has none). */
  setListeners(key: string, listeners: DragListeners | undefined): void {
    if (listeners) this.handlers.set(key, listeners);
    else this.handlers.delete(key);
  }

  /** Widget side: call `key`'s listener for `eventName` (`"onPointerDown"`),
   *  if the layer bound one. */
  dispatch(key: string, eventName: string, event: unknown): void {
    const listener = this.handlers.get(key)?.[eventName];
    if (typeof listener === "function") listener(event);
  }
}

/** A copy of `array` with the item at `from` moved to `to` (dnd-kit's
 *  `arrayMove`, here so a widget can reorder without loading dnd-kit). */
export function arrayMove<T>(array: readonly T[], from: number, to: number): T[] {
  const next = array.slice();
  const at = to < 0 ? next.length + to : to;
  const [item] = next.splice(from, 1);
  next.splice(at, 0, item as T);
  return next;
}
