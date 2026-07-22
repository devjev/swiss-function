---
bump: minor
---
DatePicker: precision prop picks ISO weeks, months and years. The value normalizes to the period start (Monday, the 1st, Jan 1), the field shows YYYY-Www / YYYY-MM / YYYY, and typed entry accepts forms like w29, jul, 2028; min/max keep a period pickable while it overlaps the range.
