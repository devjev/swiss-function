/** "Jump to field" for a consumer's central hotkey system (issue #32).
 *
 *  A `Field` given a `hotkey` prop tags itself with `data-hotkey={combo}` and
 *  shows a `Kbd` badge, but binds no key — the library owns no global listener.
 *  The consumer handles the press in their own shortcut layer and calls this to
 *  move focus into the matching field:
 *
 *    useMyHotkey("g u", () => focusFieldHotkey("g u"));
 *
 *  Finds the first `[data-hotkey="combo"]` under `root` (the document by
 *  default), focuses the first focusable control inside it, and returns whether
 *  it focused anything. */
const FOCUSABLE =
  'input, select, textarea, button, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focusFieldHotkey(combo: string, root: ParentNode = document): boolean {
  // Match by attribute value (not a built selector) so arbitrary combos —
  // spaces, "+", punctuation — never need CSS escaping.
  for (const field of root.querySelectorAll("[data-hotkey]")) {
    if (field.getAttribute("data-hotkey") !== combo) continue;
    const control = field.querySelector<HTMLElement>(FOCUSABLE);
    if (!control) return false;
    control.focus();
    return true;
  }
  return false;
}
