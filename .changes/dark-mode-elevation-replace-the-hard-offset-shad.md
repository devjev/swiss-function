---
bump: patch
---
Dark-mode elevation: replace the hard offset shadow with a luminance model — a slight full-bleed lightening film above level 1 (surface reads a touch lighter than the page) plus a 1px inset edge that brightens with the level (bordered rims read progressively lighter). Rides the same --sf-elevation-N token, so every elevated component gets it. Light mode unchanged.
