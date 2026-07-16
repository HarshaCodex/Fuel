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

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
