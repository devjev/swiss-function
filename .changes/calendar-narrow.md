---
bump: minor
---
`Calendar` adapts to its own width: the week view shows as many days as fit (`weekDays`, `"auto"` by default: the ISO week, three days or one day from the focused date, with prev / next stepping by the days shown), the toolbar wraps instead of clipping, week headings no longer print the day number over the weekday, an event shows its time and title whole or not at all, and the month grid shortens `+4 more` to `+4`. A busy week in a short month view no longer prints its overflow line over the next week.
