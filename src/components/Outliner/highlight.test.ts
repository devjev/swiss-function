import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import {
  findHighlights,
  HIGHLIGHT_COLORS,
  holdEscapedDelimiters,
  readColorPrefix,
  remarkHighlight,
} from "./highlight";
import { passthroughUrlTransform, preprocessOutlinerMarkdown } from "./markdown-extensions";
import { plainLabel } from "./zoom";

/** A block's markdown as the outline renders it, without the paragraph. */
function html(source: string): string {
  const markup = renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkHighlight],
        urlTransform: passthroughUrlTransform,
      },
      preprocessOutlinerMarkdown(source),
    ),
  );
  return markup.replace(/^<p>|<\/p>$/g, "");
}

const mark = (color: string, inner: string) => `<mark data-highlight="${color}">${inner}</mark>`;

describe("highlights", () => {
  it("reads ==text== in the default colour", () => {
    expect(html("a ==b c== d")).toBe(`a ${mark("yellow", "b c")} d`);
  });

  it("reads a named colour and drops the name", () => {
    for (const color of HIGHLIGHT_COLORS) {
      expect(html(`=={${color}}ok==`)).toBe(mark(color, "ok"));
    }
  });

  it("keeps an unknown name as text inside a default highlight", () => {
    expect(html("=={red}x==")).toBe(mark("yellow", "{red}x"));
  });

  it("reads ^^text^^ as a default highlight, with no colour name", () => {
    expect(html("a ^^b^^")).toBe(`a ${mark("yellow", "b")}`);
    expect(html("^^{green}b^^")).toBe(mark("yellow", "{green}b"));
  });

  it("needs a word on the inside of each delimiter", () => {
    expect(html("a == b == c")).toBe("a == b == c");
    expect(html("== a==")).toBe("== a==");
    expect(html("==a ==")).toBe("==a ==");
  });

  it("takes exactly two characters as a delimiter", () => {
    expect(html("===a===")).toBe("===a===");
    expect(html("=a=")).toBe("=a=");
  });

  it("reads a highlight inside a word", () => {
    expect(html("a==b==c")).toBe(`a${mark("yellow", "b")}c`);
  });

  it("reads several highlights on one line", () => {
    expect(html("==a== and =={blue}b==")).toBe(`${mark("yellow", "a")} and ${mark("blue", "b")}`);
  });

  it("holds bold, italic, links and wiki links", () => {
    expect(html("==**bold** and *it*==")).toBe(
      mark("yellow", "<strong>bold</strong> and <em>it</em>"),
    );
    expect(html("=={green}see [x](https://a.ch)==")).toBe(
      mark("green", 'see <a href="https://a.ch">x</a>'),
    );
    expect(html("==[[Page]]==")).toBe(mark("yellow", '<a href="wiki:Page">Page</a>'));
  });

  it("reads a highlight inside bold", () => {
    expect(html("**==a==**")).toBe(`<strong>${mark("yellow", "a")}</strong>`);
  });

  it("does not cross a level of nesting", () => {
    expect(html("==a **b== c**")).toBe("==a <strong>b== c</strong>");
  });

  it("leaves code alone", () => {
    expect(html("`==a==`")).toBe("<code>==a==</code>");
    expect(html("x `a` ==b==")).toBe(`x <code>a</code> ${mark("yellow", "b")}`);
  });

  it("takes an escaped delimiter literally, and code keeps its backslash", () => {
    expect(html("\\==a==")).toBe("==a==");
    expect(html("a \\^^b^^")).toBe("a ^^b^^");
    expect(html("`\\==`")).toBe("<code>\\==</code>");
    // An escaped backslash does not escape the delimiter after it.
    expect(html("\\\\==a==")).toBe(`\\${mark("yellow", "a")}`);
  });

  it("does not nest", () => {
    expect(html("==a ^^b^^ c==")).toBe(mark("yellow", "a ^^b^^ c"));
  });
});

describe("holdEscapedDelimiters", () => {
  it("holds \\= and \\^ and leaves other escapes", () => {
    expect(holdEscapedDelimiters("\\= \\^ \\* \\\\=")).toBe("  \\* \\\\=");
  });
});

describe("readColorPrefix", () => {
  it("reads the six names only", () => {
    expect(readColorPrefix("{purple}x")).toBe("purple");
    expect(readColorPrefix("{red}x")).toBeNull();
    expect(readColorPrefix("x{green}")).toBeNull();
  });
});

describe("plainLabel", () => {
  it("drops the highlight markup and the colour name", () => {
    expect(plainLabel("=={green}Approved== by ==Ana==")).toBe("Approved by Ana");
    expect(plainLabel("^^a^^ b")).toBe("a b");
  });
});

describe("findHighlights", () => {
  it("finds the spans of a line by the transform's rules", () => {
    expect(findHighlights("a ==b== =={green}c== ^^d^^")).toEqual([
      { from: 2, to: 7, opener: 2, kind: "=", color: "yellow" },
      { from: 8, to: 20, opener: 9, kind: "=", color: "green" },
      { from: 21, to: 26, opener: 2, kind: "^", color: "yellow" },
    ]);
  });

  it("skips code spans, escapes and delimiters with a space inside", () => {
    expect(findHighlights("`==a==` \\==b== c == d == e")).toEqual([]);
  });
});
