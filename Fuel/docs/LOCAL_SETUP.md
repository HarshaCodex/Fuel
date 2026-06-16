# Local Setup Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 25 | Required by `pom.xml` |
| Maven | 3.9+ | Or use the included `mvnw` wrapper — no install needed |
| Docker Desktop | Latest | For running infrastructure services |
| Git | Any | To clone the repo |

---

## Step 1 — Clone the Repository

```bash
git clone <repo-url>
cd "Fuel/backend"
```

---

## Step 2 — Start Infrastructure with Docker Compose

The `docker-compose.yml` spins up three services: PostgreSQL, Redis, and Mailpit (local email catcher).

```bash
# From Fuel/backend/
docker compose up -d
```

**What gets started:**

| Container | Port | Purpose |
|-----------|------|---------|
| `fuel-postgres` | `5432` | PostgreSQL 16 database |
| `fuel-redis` | `6379` | Redis 7 cache |
| `fuel-mailpit` | `1025` (SMTP) / `8025` (UI) | Local mail server |

**Verify all containers are healthy:**

```bash
docker compose ps
```

All three should show `healthy` or `running`. Postgres may take ~15 seconds on first boot.

**View logs if something looks wrong:**

```bash
docker compose logs postgres
docker compose logs redis
docker compose logs mailpit
```

---

## Step 3 — Check `application.properties`

The file at `src/main/resources/application.properties` is pre-configured to match the Docker Compose credentials. No changes are needed for local development.

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/fuel
spring.datasource.username=fuel_user
spring.datasource.password=fuel_pass

spring.data.redis.host=localhost
spring.data.redis.port=6379

spring.mail.host=localhost
spring.mail.port=1025
```

---

## Step 4 — Run the Application

**Option A — Maven wrapper (recommended, no Maven install required):**

```bash
# Windows
.\mvnw.cmd spring-boot:run

# Mac / Linux
./mvnw spring-boot:run
```

**Option B — Build a JAR first, then run:**

```bash
# Windows
.\mvnw.cmd clean package -DskipTests
java -jar target/fuel-0.0.1-SNAPSHOT.jar

# Mac / Linux
./mvnw clean package -DskipTests
java -jar target/fuel-0.0.1-SNAPSHOT.jar
```

On first startup, Flyway automatically runs any pending database migrations.

---

## Step 5 — Verify

The app starts on port `8080`.

- API: `http://localhost:8080`
- Mailpit UI (inspect outgoing emails): `http://localhost:8025`

---

## Stopping Everything

```bash
# Stop the Spring Boot app
Ctrl+C

# Stop Docker containers (data is preserved)
docker compose stop

# Stop and remove containers + volumes (clean slate)
docker compose down -v
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Connection refused` on port 5432 | Postgres may still be initializing. Run `docker compose ps` and wait for `healthy`, then retry. |
| Flyway migration errors on startup | Confirm the DB container is healthy before starting the app. |
| Java version mismatch | Run `java -version` — must be 25. Install via [SDKMAN](https://sdkman.io/) or directly from [jdk.java.net](https://jdk.java.net). |
| Port already in use | Stop any local Postgres or Redis services running outside Docker. |
