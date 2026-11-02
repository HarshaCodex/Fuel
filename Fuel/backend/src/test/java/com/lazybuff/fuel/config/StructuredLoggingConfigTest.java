package com.lazybuff.fuel.config;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import ch.qos.logback.classic.util.LogbackMDCAdapter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.logging.logback.StructuredLogEncoder;
import org.springframework.core.env.Environment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.ResourcePropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Checks the structured (JSON) logging setup of the prod profile (#99). */
@DisplayName("Structured logging configuration")
class StructuredLoggingConfigTest {

    private static StandardEnvironment environment(
            final Map<String, Object> envVars, final boolean prodProfile) throws IOException {
        final StandardEnvironment env = new StandardEnvironment();
        final MutablePropertySources sources = env.getPropertySources();
        sources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        sources.addLast(new MapPropertySource("testEnv", envVars));
        if (prodProfile) {
            sources.addLast(
                    new ResourcePropertySource(
                            new ClassPathResource("application-prod.properties")));
        }
        sources.addLast(
                new ResourcePropertySource(new ClassPathResource("application.properties")));
        return env;
    }

    @Test
    @DisplayName("prod profile logs ECS JSON to the console")
    void shouldUseEcsJsonInProd() throws IOException {
        final StandardEnvironment env = environment(Map.of(), true);

        assertThat(env.getProperty("logging.structured.format.console")).isEqualTo("ecs");
        assertThat(env.getProperty("logging.structured.ecs.service.environment"))
                .isEqualTo("production");
    }

    @Test
    @DisplayName("prod profile tags logs with APP_ENVIRONMENT when set")
    void shouldTagEnvironmentFromEnvVar() throws IOException {
        final StandardEnvironment env = environment(Map.of("APP_ENVIRONMENT", "staging"), true);

        assertThat(env.getProperty("logging.structured.ecs.service.environment"))
                .isEqualTo("staging");
    }

    @Test
    @DisplayName("local runs keep the readable console format")
    void shouldKeepPlainLogsLocally() throws IOException {
        final StandardEnvironment env = environment(Map.of(), false);

        assertThat(env.getProperty("logging.structured.format.console")).isNull();
    }

    @Test
    @DisplayName("an error with a stack trace is encoded as a single JSON line")
    void shouldKeepStackTraceInsideOneJsonLine() throws IOException {
        final LoggerContext context = new LoggerContext();
        // Spring Boot's logging system puts the Environment here; the encoder reads it from there.
        context.putObject(
                Environment.class.getName(),
                environment(Map.of("APP_ENVIRONMENT", "staging"), true));
        context.setMDCAdapter(new LogbackMDCAdapter());
        final StructuredLogEncoder encoder = new StructuredLogEncoder();
        encoder.setContext(context);
        encoder.setFormat("ecs");
        encoder.start();
        final LoggingEvent event =
                new LoggingEvent(
                        getClass().getName(),
                        context.getLogger("com.lazybuff.fuel.Example"),
                        Level.ERROR,
                        "Request failed",
                        new IllegalStateException("boom"),
                        null);

        final String line = new String(encoder.encode(event), StandardCharsets.UTF_8).strip();

        assertThat(line).doesNotContain("\n");
        final JsonNode json = JsonMapper.builder().build().readTree(line);
        assertThat(json.path("log").path("level").asString()).isEqualTo("ERROR");
        assertThat(json.path("message").asString()).isEqualTo("Request failed");
        assertThat(json.path("service").path("environment").asString()).isEqualTo("staging");
        assertThat(json.path("error").path("stack_trace").asString())
                .contains("IllegalStateException: boom")
                .contains("\n");
    }
}
