---
bump: patch
---
PopOut: the chromeless Picture-in-Picture pop-out ( / ) no longer opens then immediately closes under React StrictMode in dev. The open session is adopted across the StrictMode remount instead of issuing a second  that rejects (#86).
