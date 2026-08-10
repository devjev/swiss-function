---
bump: patch
---
DataTable: row scroll-snap no longer parks the first row half-hidden behind a header taller than the default 1.5u (a two-line header, a taller cell). The snap origin (scroll-padding-top) is measured from the real sticky-header height and published as --sf-header-block-size, instead of a fixed count of 1.5u header rows (#88).
