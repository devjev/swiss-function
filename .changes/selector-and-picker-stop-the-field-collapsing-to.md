---
bump: patch
---
Selector and Picker: stop the field collapsing to the search input's min-content in a shrink-to-fit parent (an inline-flex toolbar, a float, an auto grid track), where inline-size: 100% is inert. panel/inline Selector and Picker now hold a 12rem width floor (tunable via --sf-selector-min-inline-size / --sf-picker-min-inline-size, 0 disables); compact stays fit-content. A narrow definite cell still clamps the control so it fills rather than overflows (issue #25 unchanged).
