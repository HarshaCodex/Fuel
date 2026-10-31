package com.lazybuff.fuel.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.mail.autoconfigure.MailSenderAutoConfiguration;
import org.springframework.boot.mail.autoconfigure.MailSenderValidatorAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.ResourcePropertySource;

/**
 * Verifies the mail settings in {@code application.properties} and {@code
 * application-prod.properties}.
 *
 * <p>Builds an environment with Spring Boot's precedence (env vars, then profile file, then base
 * file) without starting the application context, so no database or SMTP server is needed.
 */
@DisplayName("Mail configuration")
class MailPropertiesConfigTest {

    private static final String BASE_PROPERTIES = "application.properties";
    private static final String PROD_PROPERTIES = "application-prod.properties";

    private static Map<String, Object> prodEnvVars() {
        final Map<String, Object> vars = new HashMap<>();
        vars.put("MAIL_HOST", "email-smtp.eu-west-1.amazonaws.com");
        vars.put("MAIL_USERNAME", "smtp-user");
        vars.put("MAIL_PASSWORD", "smtp-secret");
        vars.put("MAIL_FROM", "no-reply@fuel.app");
        vars.put("FRONTEND_URL", "https://fuel.app");
        return vars;
    }

    private static StandardEnvironment environment(
            final Map<String, Object> envVars, final boolean prodProfile) throws IOException {
        final StandardEnvironment env = new StandardEnvironment();
        final MutablePropertySources sources = env.getPropertySources();
        sources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        sources.addLast(new MapPropertySource("testEnv", envVars));
        if (prodProfile) {
            sources.addLast(new ResourcePropertySource(new ClassPathResource(PROD_PROPERTIES)));
        }
        sources.addLast(new ResourcePropertySource(new ClassPathResource(BASE_PROPERTIES)));
        return env;
    }

    @Nested
    @DisplayName("default (local) profile")
    class DefaultProfile {

        @Test
        @DisplayName("targets the local Mailpit catcher without authentication")
        void shouldTargetMailpitWhenNoEnvVarsSet() throws IOException {
            final StandardEnvironment env = environment(Map.of(), false);

            assertThat(env.getProperty("spring.mail.host")).isEqualTo("localhost");
            assertThat(env.getProperty("spring.mail.port")).isEqualTo("1025");
            assertThat(env.getProperty("spring.mail.properties.mail.smtp.auth")).isEqualTo("false");
            assertThat(env.getProperty("spring.mail.test-connection")).isNull();
        }

        @Test
        @DisplayName("bounds SMTP connection, read and write timeouts")
        void shouldConfigureSmtpTimeouts() throws IOException {
            final StandardEnvironment env = environment(Map.of(), false);

            assertThat(env.getProperty("spring.mail.properties.mail.smtp.connectiontimeout"))
                    .isEqualTo("5000");
            assertThat(env.getProperty("spring.mail.properties.mail.smtp.timeout"))
                    .isEqualTo("5000");
            assertThat(env.getProperty("spring.mail.properties.mail.smtp.writetimeout"))
                    .isEqualTo("5000");
        }
    }

    @Nested
    @DisplayName("prod profile")
    class ProdProfile {

        @Test
        @DisplayName("uses the provider's host and credentials from environment variables")
        void shouldUseProviderSettingsFromEnvVars() throws IOException {
            final StandardEnvironment env = environment(prodEnvVars(), true);

            assertThat(env.getProperty("spring.mail.host"))
                    .isEqualTo("email-smtp.eu-west-1.amazonaws.com");
            assertThat(env.getProperty("spring.mail.port")).isEqualTo("587");
            assertThat(env.getProperty("spring.mail.username")).isEqualTo("smtp-user");
            assertThat(env.getProperty("spring.mail.password")).isEqualTo("smtp-secret");
            assertThat(env.getProperty("app.mail.from-email-address"))
                    .isEqualTo("no-reply@fuel.app");
            assertThat(env.getProperty("app.frontend.reset-password.url"))
                    .isEqualTo("https://fuel.app/reset-password?token=");
        }

        @Test
        @DisplayName("requires authenticated SMTP over STARTTLS")
        void shouldRequireAuthAndStartTls() throws IOException {
            final StandardEnvironment env = environment(prodEnvVars(), true);

            assertThat(env.getProperty("spring.mail.properties.mail.smtp.auth")).isEqualTo("true");
            assertThat(env.getProperty("spring.mail.properties.mail.smtp.starttls.enable"))
                    .isEqualTo("true");
            assertThat(env.getProperty("spring.mail.properties.mail.smtp.starttls.required"))
                    .isEqualTo("true");
        }

        @Test
        @DisplayName("tests the SMTP connection on startup")
        void shouldTestConnectionOnStartup() throws IOException {
            final StandardEnvironment env = environment(prodEnvVars(), true);

            assertThat(env.getProperty("spring.mail.test-connection")).isEqualTo("true");
        }

        @Test
        @DisplayName("fails startup instead of falling back to Mailpit when MAIL_HOST is missing")
        void shouldFailStartupWhenMailHostMissing() {
            final Map<String, Object> vars = prodEnvVars();
            vars.remove("MAIL_HOST");
            final ApplicationContextRunner runner =
                    new ApplicationContextRunner()
                            .withConfiguration(
                                    AutoConfigurations.of(
                                            MailSenderAutoConfiguration.class,
                                            MailSenderValidatorAutoConfiguration.class))
                            .withInitializer(
                                    context -> {
                                        final MutablePropertySources sources =
                                                context.getEnvironment().getPropertySources();
                                        try {
                                            environment(vars, true)
                                                    .getPropertySources()
                                                    .forEach(sources::addLast);
                                        } catch (IOException e) {
                                            throw new IllegalStateException(e);
                                        }
                                    });

            runner.run(
                    context ->
                            assertThat(context)
                                    .getFailure()
                                    .rootCause()
                                    .hasMessageContaining("MAIL_HOST"));
        }

        @Test
        @DisplayName("fails instead of using the placeholder sender when MAIL_FROM is missing")
        void shouldFailWhenMailFromMissing() throws IOException {
            final Map<String, Object> vars = prodEnvVars();
            vars.remove("MAIL_FROM");
            final StandardEnvironment env = environment(vars, true);

            assertThatThrownBy(() -> env.getProperty("app.mail.from-email-address"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("MAIL_FROM");
        }

        @Test
        @DisplayName("fails instead of linking to the example domain when FRONTEND_URL is missing")
        void shouldFailWhenFrontendUrlMissing() throws IOException {
            final Map<String, Object> vars = prodEnvVars();
            vars.remove("FRONTEND_URL");
            final StandardEnvironment env = environment(vars, true);

            assertThatThrownBy(() -> env.getProperty("app.frontend.reset-password.url"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("FRONTEND_URL");
        }
    }
}
