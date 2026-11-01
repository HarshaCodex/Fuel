package com.lazybuff.fuel.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("EmailNormalizer")
class EmailNormalizerTest {

    @Test
    @DisplayName("trims and lower-cases")
    void shouldTrimAndLowercase() {
        assertThat(EmailNormalizer.normalize("  Jane.Doe@Example.COM "))
                .isEqualTo("jane.doe@example.com");
    }

    @Test
    @DisplayName("leaves an already-normalised email unchanged")
    void shouldKeepNormalisedEmail() {
        assertThat(EmailNormalizer.normalize("jane@example.com")).isEqualTo("jane@example.com");
    }

    @Test
    @DisplayName("passes null through")
    void shouldReturnNullForNull() {
        assertThat(EmailNormalizer.normalize(null)).isNull();
    }
}
