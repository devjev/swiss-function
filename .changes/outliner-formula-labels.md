---
bump: minor
---
Outliner: formulas render where a block is shown as one plain line. The breadcrumb, the label that follows a dragged block, a board's column titles and dragged card, and a query's results (the text and the path) now render the registered inline spans (`$x$` as math) instead of showing their source. New export `OutlinerLabel` (`content`, `plain?`, `empty?`) for a registered block type that lists other blocks. **Changed behaviour:** an inline span holds no backtick, so a price before a code span (``for $5 and `$x$` ``) stays text. **Fixed:** an inline formula at a font size where the line's spare height is odd (the breadcrumb's) made its line half a pixel taller.
