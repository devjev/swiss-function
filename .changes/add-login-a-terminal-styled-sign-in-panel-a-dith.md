---
bump: minor
---
Add Login, a terminal-styled sign-in panel: a dithered title bar, monospace identifier and password fields (DOS block caret, mono show/hide toggle), a terminal error line, and slots for a footer and other auth methods (alternatives, below a dithered divider). Self-contained: it holds the field state and reports the credentials on submit; you drive loading and error. Complements Input type=password for a bare password field and DigitInput mode=mask for 2FA/OTP/PIN.
