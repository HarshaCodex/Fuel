# Local Setup Guide

There are two ways to run the backend locally:

- **Option 1 — Full Docker (recommended):** the app *and* all infrastructure run in
  containers. One command, nothing to install but Docker.
- **Option 2 — App on host + infra in Docker:** run PostgreSQL/Redis/Mailpit in Docker
  and run the Spring Boot app yourself via Maven. Better for fast iteration and debugging.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Desktop | Latest | Required for both options |
| Git | Any | To clone the repo |
| Java | 25 | Only for Option 2 (host run) |
| Maven | 3.9+ | Only for Option 2 — or use the included `mvnw` wrapper (no install needed) |

---

## Step 1 — Clone the Repository

```bash
git clone <repo-url>
cd "Fuel/backend"
```

---

## Step 2 — Create the `.env` File

The `.env` file is **required** and is **not committed** (it's git-ignored). Docker Compose
loads it, and the app reads these values for the database and JWT signing key.

Create `Fuel/backend/.env`:

```dotenv
DATABASE_URL=jdbc:postgresql://localhost:5432/fuel
DATABASE_USERNAME=fuel_user
DATABASE_PASSWORD=fuel_pass
JWT_SECRET=<base64-encoded-secret>
```

Notes:

- The default DB credentials above match the Compose Postgres service — no need to change them.
- `DATABASE_URL` uses `localhost` here (correct for Option 2). When running via Compose, the
  `app` service overrides it to point at the `postgres` container automatically — no edit needed.
- `JWT_SECRET` must be a Base64-encoded value with enough entropy for HS512 (≥ 64 bytes / 512 bits).
  Generate one with:

  ```bash
  openssl rand -base64 64 | tr -d '\n'
  ```

---

## Option 1 — Full Docker (recommended)

Builds the app image and starts everything: app, PostgreSQL, Redis, and Mailpit.

```bash
# From Fuel/backend/
docker compose up --build
```

Add `-d` to run detached. Compose waits for Postgres and Redis to report healthy before
starting the app.

**What gets started:**

| Container | Port | Purpose |
|-----------|------|---------|
| `fuel-app` | `8080` | Spring Boot application |
| `fuel-postgres` | `5432` | PostgreSQL 16 database |
| `fuel-redis` | `6379` | Redis 7 cache |
| `fuel-mailpit` | `1025` (SMTP) / `8025` (UI) | Local mail server |

The app image is a multi-stage build (see `Dockerfile`): it compiles with the Temurin 25 JDK
and runs on the Temurin 25 JRE as an unprivileged user.

**Rebuild after code changes:**

```bash
docker compose up --build
```

Skip to [Step: Verify](#verify).

---

## Option 2 — App on Host + Infra in Docker

### 2a. Start infrastructure only

Start just the backing services (not the `app` container):

```bash
# From Fuel/backend/
docker compose up -d postgres redis mailpit
```

**Verify all containers are healthy:**

```bash
docker compose ps
```

Postgres may take ~15 seconds on first boot. View logs if something looks wrong:

```bash
docker compose logs postgres
docker compose logs redis
docker compose logs mailpit
```

### 2b. Export environment variables

`application.properties` reads `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and
`JWT_SECRET` from the environment, and **has no defaults for them** — the app will fail to
start if they're missing. There is no dotenv library, so Spring does **not** read `.env`
automatically when run via Maven. Export the values from `.env` into your shell first:

```bash
# Mac / Linux — load .env into the current shell
set -a && source .env && set +a
```

```powershell
# Windows PowerShell — load .env into the current session
Get-Content .env | Where-Object { $_ -match '=' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$($name.Trim())" -Value $value.Trim()
}
```

> `REDIS_HOST`/`REDIS_PORT` and `MAIL_HOST`/`MAIL_PORT` default to `localhost` and the standard
> ports, so they don't need to be set for a host run.

### 2c. Run the application

**Option A — Maven wrapper (recommended, no Maven install required):**

```bash
# Mac / Linux
./mvnw spring-boot:run

# Windows
.\mvnw.cmd spring-boot:run
```

**Option B — Build a JAR first, then run:**

```bash
# Mac / Linux
./mvnw clean package -DskipTests
java -jar target/fuel-0.0.1-SNAPSHOT.jar

# Windows
.\mvnw.cmd clean package -DskipTests
java -jar target/fuel-0.0.1-SNAPSHOT.jar
```

On first startup, Flyway automatically runs any pending database migrations.

---

## Verify

The app starts on port `8080`.

- API base: `http://localhost:8080`
- Mailpit UI (inspect outgoing emails): `http://localhost:8025`

**Smoke-test the auth endpoint:**

```bash
curl -i -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Password123!","timezone":"Asia/Kolkata"}'
```

A `201 Created` response confirms the app, database, and JWT config are all wired up.

Request field rules:

- `password` — 8–30 chars with at least one uppercase, one lowercase, one digit, and one
  special character (`@$!%*?&`).
- `timezone` — required IANA zone id (e.g. `Asia/Kolkata`, `America/New_York`, `UTC`). The
  client is expected to send its own zone; an unrecognised value returns `400 Bad Request`.
  It is stored per-user (no longer derived from the server's clock).

---

## Stopping Everything

```bash
# Stop a host-run Spring Boot app (Option 2)
Ctrl+C

# Stop Docker containers (data is preserved)
docker compose stop

# Stop and remove containers (volumes preserved)
docker compose down

# Stop and remove containers + volumes (clean slate — wipes DB and Redis data)
docker compose down -v
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| App exits immediately with a placeholder/`${...}` or "Could not resolve" error | Env vars aren't set. For Option 2, run `set -a && source .env && set +a` before starting. |
| `WeakKeyException` / JWT key too short | `JWT_SECRET` must be Base64 and ≥ 64 bytes. Regenerate with `openssl rand -base64 64`. |
| `Connection refused` on port 5432 | Postgres may still be initializing. Run `docker compose ps` and wait for `healthy`, then retry. |
| Flyway migration errors on startup | Confirm the DB container is healthy before starting the app. |
| Java version mismatch (Option 2) | Run `java -version` — must be 25. Install via [SDKMAN](https://sdkman.io/) or from [jdk.java.net](https://jdk.java.net). |
| Port already in use | Stop any local Postgres/Redis/app already using `5432`, `6379`, or `8080` outside Docker. |
| Stale app image after code changes | Rebuild with `docker compose up --build` (Option 1). |
