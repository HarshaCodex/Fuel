# 0003. Sign-up that doesn't reveal which emails have accounts

- **Status:** Accepted
- **Date:** 2026-11-01
- **Issue:** #86

## Context

The auth audit found four ways to check whether an email has a Fuel account. For a diet and
fitness app, "this person uses Fuel" is itself private.

- `POST /register` answered `409 Email already exists`.
- `POST /login` skipped bcrypt for unknown emails: ~5 ms instead of ~230 ms for a wrong password.
- `POST /verify-email` answered `409 Email already verified`.
- `POST /reset-password` answered `400 Please verify your email first`.

Register also signed the user in straight away. A "check your email" reply can't coexist with
that, because getting tokens back would reveal the email was new.

## Decision

- **Register always answers `202` "check your email"**, with no tokens or user data. The
  password is hashed and the timezone validated before the existence check, so both paths take
  about the same time.
  - New email: the account is created and a verification code is emailed (as before).
  - Taken email: nothing changes; the owner gets an "you already have an account" email, capped
    per account with the resend-verification limit (3/hour). Over the cap the email is skipped,
    not answered with 429, which would leak.
- **Verify-email signs the user in**, returning the same tokens as login. Unknown emails,
  already-verified accounts and wrong codes all get the same `401`.
- **Login** runs bcrypt against a dummy hash when there's no password to check, and rejects
  unverified email/password accounts with `403`. The 403 needs the right password, so it tells a
  stranger nothing.
- **Reset-password works for unverified accounts** and marks the email verified, since the emailed
  code proves inbox ownership.

Together these also close the "squatter" gap: someone who registers another person's email can't
verify it, so they can't log in, and the real owner can take the address back with a password
reset (which replaces the password and ends all sessions) or Google/Apple sign-in (ADR 0001).
Sign-ups that are never verified are purged after 7 days (#89,
`app.unverified-account.retention`).

## Consequences

- **Breaking API change:** register returns `202` without tokens; clients sign in from
  verify-email. The app flow is register → enter code → signed in.
- A user who registers again with their own email gets a reminder email instead of an error; the
  app should tell them to check their inbox either way.
- Register still takes a few ms longer for a new email (database writes), far below network
  jitter. Login's first dummy-hash check after startup is slower, once.
- Google/Apple sign-in still reveal linking errors (409) to someone holding a valid provider token
  for that email, which already proves ownership of the address.
