package com.lazybuff.fuel.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.SentryLevel;
import io.sentry.SentryOptions;
import io.sentry.spring.boot4.SentryAutoConfiguration;
import io.sentry.spring.boot4.SentryLogbackAppenderAutoConfiguration;
import io.sentry.spring.boot4.SentryProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.ResourcePropertySource;

/**
 * Binds the real Sentry settings from the property files (#100) and checks what gets reported,
 * without a network: a {@code beforeSend} callback records each event and drops it.
 */
@DisplayName("Sentry configuration")
class SentryConfigTest {

    private static final String TEST_DSN = "https://publickey@o0.ingest.sentry.io/0";

    private final List<SentryEvent> sentEvents = new CopyOnWriteArrayList<>();

    @AfterEach
    void closeSentry() {
        Sentry.close();
    }

    private WebApplicationContextRunner runner(
            final Map<String, Object> envVars, final boolean prodProfile) {
        return new WebApplicationContextRunner()
                .withConfiguration(
                        AutoConfigurations.of(
                                SentryAutoConfiguration.class,
                                SentryLogbackAppenderAutoConfiguration.class))
                .withInitializer(context -> addPropertyFiles(context, envVars, prodProfile))
                .withBean(
                        SentryOptions.BeforeSendCallback.class,
                        () ->
                                (event, hint) -> {
                                    sentEvents.add(event);
                                    return null;
                                });
    }

    private static void addPropertyFiles(
            final ConfigurableApplicationContext context,
            final Map<String, Object> envVars,
            final boolean prodProfile) {
        try {
            final MutablePropertySources sources = context.getEnvironment().getPropertySources();
            sources.addFirst(new MapPropertySource("testEnv", envVars));
            if (prodProfile) {
                sources.addAfter(
                        "testEnv",
                        new ResourcePropertySource(
                                new ClassPathResource("application-prod.properties")));
            }
            sources.addLast(
                    new ResourcePropertySource(new ClassPathResource("application.properties")));
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    @Test
    @DisplayName("is off when SENTRY_DSN isn't set")
    void shouldBeDisabledWithoutDsn() {
        runner(Map.of(), false)
                .run(
                        context -> {
                            assertThat(context).hasNotFailed();
                            assertThat(Sentry.isEnabled()).isFalse();
                        });
    }

    @Test
    @DisplayName("sends no personal data or request bodies, tagged with environment and release")
    void shouldBindPrivacySettings() {
        runner(
                        Map.of(
                                "SENTRY_DSN", TEST_DSN,
                                "APP_ENVIRONMENT", "staging",
                                "RENDER_GIT_COMMIT", "abc123"),
                        true)
                .run(
                        context -> {
                            assertThat(context).hasNotFailed();
                            final SentryProperties options =
                                    context.getBean(SentryProperties.class);
                            assertThat(Sentry.isEnabled()).isTrue();
                            assertThat(options.isSendDefaultPii()).isFalse();
                            assertThat(options.getMaxRequestBodySize())
                                    .isEqualTo(SentryOptions.RequestSize.NONE);
                            assertThat(options.getEnvironment()).isEqualTo("staging");
                            assertThat(options.getRelease()).isEqualTo("abc123");
                            assertThat(options.getInAppIncludes()).contains("com.lazybuff.fuel");
                        });
    }

    @Test
    @DisplayName("reports ERROR log events and ignores WARN")
    void shouldReportOnlyErrorLogs() {
        runner(Map.of("SENTRY_DSN", TEST_DSN), false)
                .run(
                        context -> {
                            final Logger logger = LoggerFactory.getLogger("com.lazybuff.fuel.Test");

                            logger.warn("Handled problem");
                            logger.error("Unhandled exception", new IllegalStateException("boom"));
                            Sentry.flush(2000);

                            assertThat(sentEvents).hasSize(1);
                            final SentryEvent event = sentEvents.getFirst();
                            assertThat(event.getLevel()).isEqualTo(SentryLevel.ERROR);
                            assertThat(event.getThrowable())
                                    .isInstanceOf(IllegalStateException.class);
                            // The SDK attaches an empty user; nothing identifying may be in it.
                            assertThat(event.getUser())
                                    .satisfiesAnyOf(
                                            user -> assertThat(user).isNull(),
                                            user -> {
                                                assertThat(user.getEmail()).isNull();
                                                assertThat(user.getIpAddress()).isNull();
                                                assertThat(user.getUsername()).isNull();
                                            });
                        });
    }
}
