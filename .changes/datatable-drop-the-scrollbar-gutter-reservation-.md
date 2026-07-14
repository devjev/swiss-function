---
bump: patch
---
DataTable: drop the scrollbar-gutter reservation added in 2.3.2. It was unnecessary — DataTable already mirrors the header width onto the body, which keeps the columns aligned regardless of the scrollbar — and it reserved permanent gutter space. (The real #70 fix was the same mirror, now added to Explorer.)
