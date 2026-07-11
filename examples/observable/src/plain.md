# Plain Framework content

This page uses only Framework built-ins: prose, a table, code, a callout, cards, and an Observable Plot chart. It exists so the `observable.css` theme (#53) can be judged against every kind of default content in both color schemes.

## Prose

Observable Framework renders Markdown with a serif body font by default. The swiss-function theme replaces this typography wholesale. This paragraph, the headings, the list below, and the table demonstrate the baseline.

- A list item with `inline code`
- A second item with a [link](https://example.com)
- A third item

## Table

| Instrument | Currency | Position | Price |
| ---------- | -------- | -------: | ----: |
| ALPHA 2027 | CHF      |   12,500 | 101.3 |
| BETA 2031  | EUR      |    8,000 |  97.8 |
| GAMMA 2029 | USD      |   20,000 | 103.9 |

## Code

```js echo
const answer = 6 * 7;
```

<div class="note">A Framework callout ("note"). The theme restyles these too.</div>

## Cards and Plot

<div class="grid grid-cols-2">
  <div class="card">
    <h2>A card</h2>
    <p>Cards get the alt background and a faint border by default.</p>
  </div>
  <div class="card">${
    Plot.plot({
      marks: [
        Plot.lineY([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5], {stroke: "currentColor"})
      ],
      height: 160
    })
  }</div>
</div>
