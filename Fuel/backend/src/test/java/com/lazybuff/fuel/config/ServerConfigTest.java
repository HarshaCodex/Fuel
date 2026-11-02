package com.lazybuff.fuel.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.ResourcePropertySource;

/** Checks the server settings the hosting platform relies on (#101). */
@DisplayName("Server configuration")
class ServerConfigTest {

    private static StandardEnvironment environment(final Map<String, Object> envVars)
            throws IOException {
        final StandardEnvironment env = new StandardEnvironment();
        final MutablePropertySources sources = env.getPropertySources();
        sources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        sources.addLast(new MapPropertySource("testEnv", envVars));
        sources.addLast(
                new ResourcePropertySource(new ClassPathResource("application.properties")));
        return env;
    }

    @Test
    @DisplayName("listens on the PORT the platform provides")
    void shouldUsePortEnvVar() throws IOException {
        assertThat(environment(Map.of("PORT", "10000")).getProperty("server.port"))
                .isEqualTo("10000");
    }

    @Test
    @DisplayName("defaults to port 8080 locally")
    void shouldDefaultTo8080() throws IOException {
        assertThat(environment(Map.of()).getProperty("server.port")).isEqualTo("8080");
    }

    @Test
    @DisplayName("finishes shutting down before Render's 30 s grace period ends")
    void shouldBoundShutdownBelowPlatformGracePeriod() throws IOException {
        final StandardEnvironment env = environment(Map.of());

        assertThat(env.getProperty("server.shutdown")).isNotEqualTo("immediate");
        assertThat(env.getProperty("spring.lifecycle.timeout-per-shutdown-phase")).isEqualTo("20s");
    }
}
