# Code Review — `Fuel_15` vs `origin/dev` (auth system)

Generated review of the auth-system feature branch. Ranked most-severe first.

## Top priorities

1. **`RefreshToken` `@SQLRestriction` on a nonexistent `deleted_at` column** — refresh/revoke paths fail as soon as they hit the DB. Either add the column in a migration + entity field, or drop the annotation.
2. **JWT expiry seconds-as-millis** — access tokens die in ~1 second. Multiply by 1000 (or store the config as a `Duration`).
3. **`LoggingAspect` wrong annotation package** — currently logs plaintext passwords and raw tokens at INFO. Fix the FQN to `com.lazybuff.fuel.annotation.NoLogging`.

The three `@NoLogging`-related concerns (#3) share a root cause. Findings #1–#3 are hard runtime/security bugs; #4–#10 range from a latent transaction failure down to contract/consistency nits.

---

## Findings

### 1. `RefreshToken` — `@SQLRestriction("deleted_at IS NULL")` references a column that does not exist
- **File:** `src/main/java/com/lazybuff/fuel/entity/RefreshToken.java:27` (`@SQLRestriction`)
- **Severity:** Critical
- **Details:** `V4__Create_refresh_tokens_table.sql` defines no `deleted_at` column and the entity has no `deletedAt` field, but `@SQLRestriction` appends `WHERE deleted_at IS NULL` to every SELECT. `findByTokenHash` / the select-then-delete done by `deleteByTokenHash` throw `PSQLException "column deleted_at does not exist"` → every refresh and revoke operation fails at runtime.

### 2. `JwtService` — access-token expiry in seconds added directly to a millisecond epoch
- **File:** `src/main/java/com/lazybuff/fuel/service/JwtService.java` (`generateToken`, `.expiration(...)`)
- **Severity:** Critical
- **Details:** `jwt.access-token-expiry-seconds=900` (seconds). `generateToken` does `System.currentTimeMillis() + getAccessTokenExpirySeconds()`, adding 900 ms not 900 s. Every issued access token expires ~0.9 s after creation, so essentially all authenticated requests get 401. (Must be `* 1000`.) The unit tests hide this by treating the config value as milliseconds.

### 3. `LoggingAspect` — pointcut excludes the wrong annotation package
- **File:** `src/main/java/com/lazybuff/fuel/logging/LoggingAspect.java` (`@Around` pointcut)
- **Severity:** High (security / sensitive-data exposure)
- **Details:** Pointcut excludes `com.example.aspect.NoLogging`, but the real annotation is `com.lazybuff.fuel.annotation.NoLogging`. The wrong (non-existent) annotation type means the `!@annotation(...)` exclusion never matches `@NoLogging`-marked methods. `register()`, `generateToken()`, `issueRefreshToken()` are all logged at INFO with their args and return values — leaking the plaintext password (`UserRegisterRequest`), the raw JWT access token, and the raw refresh token into logs on every registration.

### 4. `RefreshTokenService` — derived delete methods invoked without a surrounding transaction
- **File:** `src/main/java/com/lazybuff/fuel/service/RefreshTokenService.java` (`revoke`, `revokeAll`)
- **Severity:** Medium
- **Details:** `revoke()` and `revokeAll()` call repository `deleteByTokenHash` / `deleteByUser_Id`. Spring Data derived delete queries are not transactional by default; when called from a non-transactional caller (e.g. a logout controller) they throw `TransactionRequiredException` ("Executing an update/delete query"). Needs `@Transactional` on these methods.

### 5. `UserData` — `accessTokenExpiresIn` reports a value 1000× longer than the token's real lifetime
- **File:** `src/main/java/com/lazybuff/fuel/dto/UserData.java` (`accessTokenExpiresIn`)
- **Severity:** Medium (client-facing contract; same root as #2)
- **Details:** `AuthService` sets `accessTokenExpiresIn = jwtConfig.getAccessTokenExpirySeconds()` = 900, telling the client the access token lasts 900 s, while `JwtService` actually expires it in 900 ms. Clients that schedule refresh based on this value will always present an already-expired token.

### 6. `UserGoals` — `@UpdateTimestamp` column also marked `updatable = false`
- **File:** `src/main/java/com/lazybuff/fuel/entity/UserGoals.java` (`updatedAt`)
- **Severity:** Medium/Low
- **Details:** `updated_at` has both `@UpdateTimestamp` and `@Column(updatable = false)`. Hibernate excludes `updatable=false` columns from UPDATE statements, so the timestamp is only ever set at insert and never refreshed on modification — defeating the annotation. (`User.java` correctly omits `updatable=false` on its `updated_at`.)

### 7. `JacksonConfig` — global String deserializer strips every incoming string
- **File:** `src/main/java/com/lazybuff/fuel/config/JacksonConfig.java` (`deserialize` → `.strip()`)
- **Severity:** Low
- **Details:** The module registers a `strip()` deserializer for all String fields. A registration password with intentional leading/trailing whitespace is silently trimmed before hashing, so the stored hash won't match what the user typed at login. Also `p.getValueAsString()` can return null for some scalar tokens, risking NPE in `.strip()`.

### 8. `UserRegisterRequest` — password `@Size` bound contradicts its message
- **File:** `src/main/java/com/lazybuff/fuel/dto/UserRegisterRequest.java` (password `@Size`)
- **Severity:** Low
- **Details:** `@Size` is `max=30` but the message says "between 8 and 20 characters." A 31-char password is rejected with a message stating the bound is 20 — the stated bound contradicts the enforced bound, confusing API consumers.

### 9. `GlobalExceptionHandler` — `handleMethodArgumentNotValidException` omits `.status()` on the body
- **File:** `src/main/java/com/lazybuff/fuel/exception/GlobalExceptionHandler.java` (`handleMethodArgumentNotValidException`)
- **Severity:** Low
- **Details:** Unlike `handleConstraintViolation`, this handler never calls `.status(HttpStatus.BAD_REQUEST.value())`, so the JSON body's `status` field is null even though the HTTP status is 400 — inconsistent contract across the two validation handlers.

### 10. `SecurityConfig` — stateless JWT filter chain without `SessionCreationPolicy.STATELESS`
- **File:** `src/main/java/com/lazybuff/fuel/config/SecurityConfig.java` (`securityFilterChain`)
- **Severity:** Low
- **Details:** CSRF is disabled and a JWT filter authenticates each request, but no `sessionManagement(...).sessionCreationPolicy(STATELESS)` is set. Spring Security still creates HTTP sessions and a JSESSIONID per authenticated request, defeating the stateless design and holding server-side session state unnecessarily.
