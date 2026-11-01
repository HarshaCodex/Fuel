# 0001. Linking Google sign-in to existing email accounts

- **Status:** Accepted
- **Date:** 2026-11-01
- **Issue:** #48

## Context

`POST /api/auth/oauth/google` verifies a Google ID token and signs the user in. The API design
(`fuel-api-reference.md`) says that when an account with the same email already exists (registered
with email/password), the Google account is **linked** to it so either method works.

Registration does not prove inbox ownership: `POST /api/auth/register` creates the account
immediately and only *sends* a verification code. That makes naive linking vulnerable to **account
pre-hijacking**:

1. An attacker registers `victim@gmail.com` with a password they choose. The account stays
   unverified; the code goes to the victim's inbox and is ignored.
2. The victim later signs in with Google. Google proves they own the address and the backend links
   Google to the attacker-created account.
3. Both now share one account. The attacker can log in with the password (or keep the sessions
   from registration) and read everything the victim tracks, and the victim gets no warning.

## Decision

When Google sign-in matches an existing account by email:

- **Account is email-verified:** the owner has already proven inbox ownership. Link Google and
  keep the password, so both login methods work.
- **Account is not verified:** Google is the first proof of who owns the address, so the
  unproven credentials are discarded before linking:
  - delete the `EMAIL` auth provider (password),
  - revoke all refresh tokens for the user,
  - mark the email as verified,
  - then link Google.
- **Account already has a different Google account linked:** reject with `409 Conflict`.

Implemented in `GoogleOAuthService.linkGoogleAccount`, covered by
`GoogleOAuthServiceTest.shouldDropUnverifiedPasswordWhenLinking` and
`shouldLinkToVerifiedEmailAccount`.

### Alternatives considered

- **Refuse to link unverified accounts** (409, "verify your email first"): safe, but the real owner
  is locked out by an account they never created and can't verify their way past an attacker's
  password without a reset flow.
- **Require the existing password before linking:** safe, but needs an extra client screen, and the
  real owner doesn't know an attacker's password.

## Consequences

- The real owner is never blocked, and an attacker's pre-registered password and sessions stop
  working the moment the owner signs in with Google. This mirrors how Auth0 and Firebase handle
  this case.
- A legitimate user who registered with a password, never verified, and later used Google loses
  that password. They can still sign in with Google, or set a new password via forgot-password
  (which now works because the email is verified).
- **Residual window:** access tokens are stateless 15-minute JWTs. Revoking refresh tokens doesn't
  invalidate an access token the attacker already holds, so they keep access for at most 15
  minutes. The same is true for logout and password reset today. Closing it would require a
  per-user token version or a denylist checked on every request, and is out of scope here.
- Email matching is currently case-sensitive (registration stores the email as typed), so a
  differently-cased address creates a separate account instead of linking. To be addressed in a
  separate issue that normalizes emails everywhere.
