---
bump: minor
---
Picker and Selector: the field ends in a chevron that opens the list and turns over while it is open, in every layout. It goes through the chevronDown icon slot, so an IconProvider swaps it with the rest of a consumer's set, and Base UI keeps it out of the tab order (the input owns the semantics). Picker's clear key now draws its cross from the close slot instead of a typed character. New internal Combobox.Trigger part.
