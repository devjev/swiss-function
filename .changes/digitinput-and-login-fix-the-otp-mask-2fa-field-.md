---
bump: patch
---
DigitInput and Login: fix the OTP mask (2FA) field breaking on @base-ui/react 1.6.0. Import the renamed `OTPField` export directly and require `@base-ui/react` ^1.6.0, so a fresh install no longer resolves a Base UI without the old `OTPFieldPreview` (#80).
