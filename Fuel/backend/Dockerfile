# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# Copy the Maven wrapper first so dependency resolution is cached
# independently of source changes.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -B

# Build the application.
COPY src/ src/
RUN ./mvnw clean package -DskipTests -B

# ---- Runtime stage ----
FROM eclipse-temurin:25-jre AS runtime
WORKDIR /app

# Run as an unprivileged user.
RUN groupadd --system spring && useradd --system --gid spring spring
USER spring:spring

COPY --from=build /workspace/target/fuel-*.jar app.jar

# Render sets PORT; the app reads it (server.port=${PORT:8080}).
EXPOSE 8080

# Container-aware JVM defaults (#101). Override JAVA_OPTS per environment without a rebuild.
#  - MaxRAMPercentage: size the heap from the container's memory limit, leaving the rest for
#    metaspace, thread stacks and native memory.
#  - ExitOnOutOfMemoryError: exit so the platform restarts the instance, rather than keep serving
#    from a JVM in an unknown state.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"

# exec makes java PID 1, so it receives SIGTERM directly and shuts down gracefully. A shell form
# is needed to expand JAVA_OPTS; JAVA_TOOL_OPTIONS would print a non-JSON notice into the logs.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
