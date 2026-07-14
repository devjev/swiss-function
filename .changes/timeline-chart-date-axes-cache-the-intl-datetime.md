---
bump: patch
---
Timeline / chart date axes: cache the Intl.DateTimeFormat used for tick labels instead of rebuilding one per label via toLocaleString. Tick formatting was the dominant cost when a view with a Timeline mounts (~120ms in a profiled route switch-back, issue #72); the cached formatter is ~40x cheaper per label with identical output.
