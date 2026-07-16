---
bump: minor
---
Chat/ChatDrawer: a ChatErrorPart (type: 'error') renders a backend error as a small NonIdealState-style glitch block with the message, optional requestId and a Retry; a new onError callback fires once when an error appears (log/toast/auto-retry), and Retry reports through onAction. Closes #77
