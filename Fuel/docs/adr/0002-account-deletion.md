# 0002. Account deletion: soft delete, purge after 30 days, re-authenticate to confirm

- **Status:** Accepted
- **Date:** 2026-11-01
- **Issue:** #64

## Context

`DELETE /api/user/account` is required by App Store guideline 5.1.1(v) (apps that let users create
accounts must let them delete them in the app) and by GDPR's right to erasure. The original API
design said "hard delete, confirm with the password", and left two questions open:

1. **What happens to the data.** An immediate hard delete is simplest, but a mistaken or malicious
   deletion (stolen phone, unlocked session) is unrecoverable, and a bug in the delete path destroys
   data at once.
2. **How users without a password confirm.** Users who signed up with Google or Apple have no
   password, and a valid access token alone shouldn't be enough to delete an account.

There was also a schema constraint: `users.email` was unique across *all* rows, so a soft-deleted
account would block the same person from signing up again.

## Decision

**Soft delete now, permanent purge after a grace period.**

- On deletion: set `users.deleted_at`, delete all `user_auth_providers` rows (password and
  Google/Apple links), and revoke all refresh tokens. The account can no longer sign in, every
  user lookup returns 404, and the email and provider IDs are free for a new sign-up immediately.
- Migration V9 replaces the `uq_users_email` constraint with a unique index on `email`
  `WHERE deleted_at IS NULL`, so uniqueness applies to active accounts only.
- `DeletedAccountPurge` runs daily (`app.account-deletion.purge-cron`) and permanently deletes
  accounts deleted more than `app.account-deletion.retention` (30 days) ago. Their custom foods
  are deleted first, since `food_items.created_by` is `ON DELETE SET NULL`. Goals, refresh tokens
  and verification codes cascade.

**Confirm ownership by re-authenticating.** The request carries exactly one of:

- `password`, for accounts with an email/password login;
- `googleIdToken`, a fresh Google ID token whose `sub` matches the account's linked Google ID;
- `appleIdentityToken`, likewise for Apple.

A user with several sign-in methods may use any of them. Attempts are rate limited per user
(5 per 15 minutes), because the endpoint checks the password and could otherwise be used to guess
it with a stolen session.

### Alternatives considered

- **Immediate hard delete:** no recovery window, and the purge logic runs on the request path.
- **Soft delete only:** keeps personal data indefinitely, which doesn't meet the right to erasure.
- **Scramble the email instead of a migration:** frees the address without a schema change, but
  erases the record's link to the person, so a support restore within the grace period becomes
  guesswork.
- **Access token alone / typing "DELETE":** a stolen session could delete the account.
- **Emailed confirmation code:** works for everyone, but adds an email round trip; re-running the
  sign-in the user already uses is quicker and equally strong.

## Consequences

- Personal data stays in the database for up to 30 days after deletion (plus backup retention).
  The privacy policy should say so.
- There is no self-service "undo". Restoring within the grace period would be a manual database
  operation (clear `deleted_at`; the user then resets their password, since their sign-in methods
  were removed), and only if the email hasn't been reused.
- Access tokens already issued remain valid until they expire (at most 15 minutes), but return 404
  on every user lookup. Same residual window as logout and password reset (see ADR 0001).
- Any new table holding user data must cascade from `users` or be cleaned up by the purge job.
- Apple requires revoking the user's Apple tokens on deletion. That is #81, which needs an Apple
  Developer key; it must land before App Store submission.
