/**
 * The Mermaid renderer the OutlinerBlocks stories and CT specs pass to
 * `createDiagramBlockType`, written the way an app would write it. Mermaid is
 * a dev dependency here: the library does not ship it.
 */

/** A token's colour as the browser resolves it (`rgb(...)`), which is the
 *  form Mermaid's theme takes: it computes with the colours, so a `var()`
 *  would not do. */
function tokenColor(name: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

let drawn = 0;

/** Diagram source to SVG markup. The colours and the font are the page's at
 *  the time of drawing. Mermaid is loaded with the first diagram. */
export async function renderMermaid(source: string): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  const fg = tokenColor("--sf-color-fg");
  const bg = tokenColor("--sf-color-bg");
  mermaid.initialize({
    startOnLoad: false,
    // The diagram's text is the outline's: nothing in it may run.
    securityLevel: "strict",
    // An error is thrown to the block, which shows it; nothing is drawn.
    suppressErrorRendering: true,
    theme: "base",
    fontFamily: getComputedStyle(document.body).fontFamily,
    themeVariables: {
      background: bg,
      primaryColor: bg,
      primaryTextColor: fg,
      primaryBorderColor: tokenColor("--sf-color-border-strong"),
      secondaryColor: tokenColor("--sf-color-bg-subtle"),
      tertiaryColor: bg,
      lineColor: fg,
      edgeLabelBackground: bg,
      textColor: fg,
      fontSize: getComputedStyle(document.body).fontSize,
    },
  });
  const { svg } = await mermaid.render(`sf-mermaid-${++drawn}`, source);
  return svg;
}
