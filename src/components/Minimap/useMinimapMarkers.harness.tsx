import { useRef, useState } from "react";
import { Minimap } from "./Minimap";
import { useMinimapMarkers } from "./useMinimapMarkers";

/** A document whose structure the Minimap reads from the DOM: h2 / h3 headers
 *  and paragraph blocks. A button appends a section, to prove re-measurement. */
export function DomDocument() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const markers = useMinimapMarkers(rootRef, [
    { selector: "h2, h3", kind: "header" },
    { selector: "p", kind: "block" },
  ]);
  return (
    <div style={{ height: 320, width: 560 }}>
      <Minimap markers={markers}>
        <div ref={rootRef} style={{ padding: 16 }}>
          <h2 id="intro">Introduction</h2>
          <p style={{ height: 240 }}>Paragraph one.</p>
          <h3>Background</h3>
          <p style={{ height: 240 }}>Paragraph two.</p>
          <h2>Method</h2>
          <p style={{ height: 240 }}>Paragraph three.</p>
          {extras.map((id, i) => (
            <div key={id}>
              <h2>Appendix {i + 1}</h2>
              <p style={{ height: 240 }}>Appended.</p>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExtras((list) => [...list, `appendix-${list.length + 1}`])}
          >
            add section
          </button>
        </div>
      </Minimap>
      <div data-testid="markers">
        {markers
          .map((m) => `${m.kind}:${m.label ?? ""}:${m.level ?? ""}:${Math.round(m.top ?? 0)}`)
          .join("|")}
      </div>
    </div>
  );
}
