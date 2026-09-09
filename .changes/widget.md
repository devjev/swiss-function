---
bump: minor
---
Widget: the shell of a chat widget, a framed card whose title bar carries the widget's input parameters. One or two params edit inline in the bar (select, date at a precision, number, text, boolean); three or more fold behind a settings key that opens a dialog with a table of them, applied at once (`onParamsChange(values, changed)`). `actions`, `loading`, `error`, `size="sm"` for a shelf. Standard widgets fill the body: `KpiWidget` (a Stat), `ChartWidget` (a BarChart), `TableWidget` (a DataTable), `ProgressWidget`. The Megachat story replies with them and keeps their parameters on the shelves. New `sliders` icon slot.
