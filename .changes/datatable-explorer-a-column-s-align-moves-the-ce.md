---
bump: minor
---
DataTable, Explorer: a column's `align` moves the cell's text again (the body span takes the free space, so moving the flex items alone did nothing), and a DataTable column that declares no `align` takes it from its data type: a `number` edit column ends, cells and heading, a `boolean` centres, everything else starts. `TableInput` already read a number column that way; the three now agree.
