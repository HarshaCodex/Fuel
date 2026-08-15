# Design: Rate Limiting for `POST /api/auth/resend-verification`

**Status:** Proposed
**Scope:** Backend (`Fuel/backend`)
**Related endpoint:** `AuthController#resendVerification` → `VerificationCodeService#resendVerification`

---

## 1. Problem & Goal

`POST /api/auth/resend-verification` re-issues an email verification code. It is
**unauthenticated** and takes only an `email`, so it can be called repeatedly to:

- **Email-bomb** a victim's inbox (each call sends a real email).
- Burn outbound-email quota / SMTP reputation.
- Grind against verification codes (a code is short-lived but low-entropy).

**Goal:** cap resend attempts to **3 per email per rolling hour**, distributed-safe
(correct across multiple app instances and app restarts), without weakening the
endpoint's existing anti-enumeration property.

### Non-goals

- Global/IP-based rate limiting (see §11 — future extension).
- Rate limiting other endpoints (login, register). The mechanism should be
  reusable, but only `resend-verification` is wired up now.
- CAPTCHA / proof-of-work.

---

## 2. Requirements

**Functional**

| # | Requirement |
|---|-------------|
| F1 | The 4th resend for the same email within a 1-hour window is rejected. |
| F2 | Rejection returns HTTP `429 Too Many Requests`. |
| F3 | The window auto-resets ~1h after the **first** counted request. |
| F4 | The limit is shared across all app instances (no per-instance counters). |
| F5 | Limit key is case-insensitive on email (`User@x.com` == `user@x.com`). |

**Non-functional**

| # | Requirement |
|---|-------------|
| N1 | A rejected request does **no** DB work and sends **no** email. |
| N2 | A `429` must not reveal whether the email is registered (anti-enumeration). |
| N3 | If the rate-limit store is unavailable, the endpoint **fails open** (availability > strictness for this action). |
| N4 | Limits (count, window) are configurable without code changes. |

---

## 3. Chosen Approach (summary)

- **Store:** Redis, using a **fixed-window counter** (`INCR` + `EXPIRE`).
  Redis is already provisioned (docker-compose `redis` service,
  `spring-boot-starter-data-redis` on the classpath, `spring.data.redis.*`
  configured) but currently unused. `StringRedisTemplate` is auto-configured.
- **Key:** per-email, normalized to lower case.
- **Enforcement point:** service layer, at the **top** of
  `resendVerification`, *before* the existing swallow-`try`.
- **Breach signal:** throw `FuelException(TOO_MANY_REQUESTS, …)`, which the
  existing `GlobalExceptionHandler` maps to a `429` body.
- **Failure mode:** fail open on Redis errors.

Rationale and alternatives are in §10–11.

---

## 4. Component Design

### 4.1 New: `RateLimiterService`

A small, endpoint-agnostic limiter so the same primitive can be reused later.

**Contract:**

```
boolean isAllowed(String key, int limit, Duration window)
```

- Atomically records one hit against `key` and returns whether the caller is
  still within `limit` for the current `window`.
- Returns `true` while `hits <= limit`, `false` once exceeded.
- **Fails open**: on any Redis/runtime error, logs a warning and returns `true`.

**Collaborators:** `StringRedisTemplate` (auto-configured; no new config bean
required).

**Placement:** `com.lazybuff.fuel.service.RateLimiterService`. Annotate the
public method `@NoLogging` so the `LoggingAspect` doesn't log limiter keys.

### 4.2 Integration into `VerificationCodeService#resendVerification`

Insert the check as the **first** statement, before the `try` that swallows
exceptions:

```
key   = "rl:resend-verification:" + request.getEmail().toLowerCase()
if (!rateLimiter.isAllowed(key, MAX_ATTEMPTS, WINDOW)) {
    throw new FuelException(TOO_MANY_REQUESTS,
        "Too many verification requests. Please try again later.");
}
// ... existing try { lookup → invalidate → generate } catch { swallow } ...
```

**Why before the `try`:** `resendVerification` deliberately catches and swallows
all internal exceptions to return a uniform 200 (anti-enumeration). If the limit
check were inside that `try`, the `429` would be swallowed and downgraded to 200.
It must sit outside so `FuelException` propagates to the handler.

> Note: the count is incremented on **every** attempt (registered or not), which
> is what provides email-bomb protection. It is intentionally *not* conditional
> on the email existing.

### 4.3 Configuration

Externalize the two knobs (N4). Recommended: a typed
`@ConfigurationProperties` holder, mirroring the existing `JwtConfig` pattern.

```
app.rate-limit.resend-verification.max-attempts=3
app.rate-limit.resend-verification.window=1h        # java.time.Duration
```

Bind into e.g. `ResendRateLimitProperties { int maxAttempts; Duration window; }`
and inject into `VerificationCodeService`. (A simpler first cut can use `private
static final` constants and be promoted to properties later.)

---

## 5. Algorithm — Fixed Window

```
count = INCR key                 # atomic; creates key at 1 on first hit
if count == 1:                   # first request of a new window
    EXPIRE key <window>          # stamp TTL so the window rolls off
allowed = count <= limit
```

- The key lives exactly one `window` from the first request, then disappears,
  which starts a fresh window on the next request.
- `EXPIRE` is set **only** when `count == 1` so repeated requests don't keep
  pushing the expiry out (which would turn it into a sliding penalty).

### 5.1 Sequence

```
Client                AuthController         VerificationCodeService        Redis
  | POST resend {email} |                          |                          |
  |-------------------->|  resendVerification(req)  |                          |
  |                     |------------------------->|  INCR rl:...:email        |
  |                     |                          |------------------------->|
  |                     |                          |<-------- count ----------|
  |                     |                          | if count==1: EXPIRE 1h    |
  |                     |                          |------------------------->|
  |   count <= 3  -> proceed (lookup/invalidate/generate) -> 200 generic       |
  |   count  > 3  -> throw FuelException(429) -> GlobalExceptionHandler -> 429  |
```

---

## 6. Data Model (Redis)

| Aspect | Value |
|--------|-------|
| Key    | `rl:resend-verification:{lowercased-email}` |
| Type   | String holding an integer counter |
| Ops    | `INCR` (implicit create), `EXPIRE` on first hit |
| TTL    | `window` (default 1h); key self-deletes at expiry |
| Value example | `rl:resend-verification:john@example.com = "2"` |

No schema migration; keys are ephemeral and namespaced by the `rl:` prefix.

---

## 7. Response Contract

**Allowed (unchanged):** `200 OK`

```json
{ "status": 200,
  "message": "If this email is registered and unverified, a new verification email has been sent.",
  "timestamp": "..." }
```

**Rate limited:** `429 Too Many Requests` (via `FuelException` →
`GlobalExceptionHandler#handleFuelException`)

```json
{ "status": 429,
  "message": "Too many verification requests. Please try again later.",
  "timestamp": "..." }
```

*(Optional, not required for v1: add a `Retry-After` header from the key's
remaining TTL — see §11.)*

---

## 8. Edge Cases

| Case | Behavior |
|------|----------|
| Email differing only by case | Same key (lower-cased) → shared budget (F5). |
| Leading/trailing whitespace in email | Already stripped globally by `JacksonConfig` before it reaches the service. |
| Redis down / timeout | `isAllowed` catches, logs warn, returns `true` → request proceeds (N3). |
| `INCR` succeeds but process dies before `EXPIRE` | Key persists with no TTL (rare). Accepted for v1; mitigations in §10.1. |
| Unregistered email | Still counted and still returns generic 200; `429` after limit doesn't disclose registration (N2). |
| Concurrent requests | `INCR` is atomic; the counter is exact under concurrency. |

---

## 9. Testing Strategy

**`RateLimiterServiceTest`** (unit, mock `StringRedisTemplate` + `ValueOperations`):

- First hit (`count==1`) → allowed **and** `EXPIRE` called with the window.
- Hit at the limit (`count==limit`) → allowed, `EXPIRE` **not** called again.
- Over limit (`count==limit+1`) → denied.
- `increment` throws (e.g. `RedisConnectionFailureException`) → **fails open** (allowed).

**`VerificationCodeServiceTest` → resend group** (mock `RateLimiterService`):

- `isAllowed==true` (registered) → existing behavior (invalidate → save → email), 200.
- `isAllowed==true` (unregistered) → generic 200, no email.
- `isAllowed==false` → throws `FuelException` `429`, and **no** interactions with
  `userRepository` / `emailService` / `invalidateAllVerificationCodes` (N1).
- Verifies the limiter is called with the **lower-cased** key and `maxAttempts`
  (F5) — e.g. call with `EMAIL.toUpperCase()`, assert key uses `EMAIL.toLowerCase()`.

**Optional integration:** an `@DataRedis`/Testcontainers test that drives three
allowed calls then a denied one against a real Redis, asserting TTL is set.

> Mockito note: `isAllowed` returns a primitive `boolean` (defaults to `false`),
> so the "allowed" resend tests **must** stub it to `true`. Stub per-test (not in
> a shared `@BeforeEach`) to avoid `UnnecessaryStubbingException` in the
> non-resend test groups under strict stubs.

---

## 10. Alternatives Considered

| Option | Verdict |
|--------|---------|
| **In-memory counter** (e.g. Caffeine/`ConcurrentHashMap`) | Rejected: not shared across instances, lost on restart (fails F4/F3). |
| **Bucket4j (+ Redis)** | Rejected for now: extra dependency; token-bucket is overkill for a simple 3/hour cap. Reconsider if we need burst+refill semantics across many endpoints. |
| **DB-based counter** (rows in Postgres) | Rejected: write amplification on the hot auth path, TTL/cleanup burden; Redis is the right tool and already present. |
| **Sliding-window log** (sorted set of timestamps) | Rejected for v1: more memory and ops per request; fixed-window is sufficient and cheaper. Note the fixed-window boundary burst caveat (§10.2). |
| **Fixed-window counter (chosen)** | Simplest correct option with existing infra. |

### 10.1 `INCR`+`EXPIRE` atomicity

Two round-trips leave a small race: if the app dies between `INCR` and `EXPIRE`,
a key can linger without a TTL. For a 3/hour cap this is negligible. If we want
it airtight, replace the two calls with a **single Lua script** (`INCR`, and
`PEXPIRE` when the result is 1) executed via `redisTemplate.execute(script,…)`,
making the operation atomic server-side. Recommended as a fast follow, not a
blocker.

### 10.2 Fixed-window boundary burst

Fixed windows allow up to `2*limit` requests across a window boundary (3 at
`:59`, 3 at `:01`). Acceptable for abuse-prevention here. Switch to sliding
window only if that burst becomes a real problem.

---

## 11. Future Extensions

- **`Retry-After` header:** read the key's remaining TTL (`getExpire`) and set
  `Retry-After` on the 429 so clients can back off precisely.
- **Second dimension (per-IP):** add an IP-keyed limit alongside the email key
  to blunt distributed spraying across many addresses. Requires threading the
  client IP (behind proxy: `X-Forwarded-For`) into the service.
- **Generalize via annotation + AOP:** introduce `@RateLimit(key, limit,
  window)` and an aspect (reusing the existing `LoggingAspect` AOP setup) that
  extracts the key from a method parameter via SpEL. This is the "deep" version
  once 2+ endpoints need limiting; a single service call is fine for one
  endpoint today.
- **Observability:** counter/metric for `resend.rate_limited` (Micrometer) to
  watch abuse and tune the threshold.

---

## 12. Implementation Checklist

- [ ] `RateLimiterService` with `isAllowed(key, limit, window)`, fail-open, `@NoLogging`.
- [ ] (Optional) `ResendRateLimitProperties` (`@ConfigurationProperties`) + `application.properties` entries.
- [ ] Wire check into `resendVerification` **before** the swallow-`try`; key = `"rl:resend-verification:" + email.toLowerCase()`.
- [ ] Throw `FuelException(HttpStatus.TOO_MANY_REQUESTS, …)` on breach (handler already covers it).
- [ ] Unit tests: `RateLimiterServiceTest` (4) + resend rate-limit cases in `VerificationCodeServiceTest`.
- [ ] Update `docs/LOCAL_SETUP.md` (note the resend limit) and any API docs.
- [ ] `./mvnw spotless:apply && ./mvnw test`.
```
