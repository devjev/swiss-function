---
bump: patch
---
HorizonChart: a tap pins the row under the finger. The click took its row from the last hover reading, which a tap never produces, so selection and `onPointActivate` did nothing on touch.
