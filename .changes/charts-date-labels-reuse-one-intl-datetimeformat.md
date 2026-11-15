---
bump: patch
---
Charts: date labels reuse one Intl.DateTimeFormat per option set instead of building one per label (Scatterplot, HorizonChart, CandlestickChart, Flows). A Multiples grid of 40 daily Scatterplots mounts in one 90ms task instead of 930ms and 230ms.
