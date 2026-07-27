import { useState } from "react";
import type { PopOutCloseReason } from "./PopOut";
import { PopOut } from "./PopOut";

/** CT harness: a toggle button driving a controlled PopOut, with the last
 *  transition (`open:reason`) exposed for assertions. */
export function PopOutHarness() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState("");
  // Unique per mount: Playwright CT reuses the page across tests in a worker,
  // so a fixed name would make window.open target a previous test's popup.
  const [name] = useState(() => `ct-popout-${Math.random().toString(36).slice(2)}`);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}>
        toggle
      </button>
      <output data-testid="last">{last}</output>
      <PopOut
        open={open}
        onOpenChange={(next: boolean, reason?: PopOutCloseReason) => {
          setOpen(next);
          setLast(`${next}:${reason ?? ""}`);
        }}
        title="CT popout"
        name={name}
        rect={{ width: 420, height: 320 }}
      >
        <p>popped content</p>
      </PopOut>
    </div>
  );
}
