package com.lazybuff.fuel.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.lazybuff.fuel.config.VerificationCodeConfig;
import com.lazybuff.fuel.util.TokenHasher;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("VerificationCodeHasher")
class VerificationCodeHasherTest {

    private static final String SECRET = base64("a-32-byte-or-longer-test-secret-value!");

    private static String base64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static VerificationCodeHasher hasher(String secret) {
        VerificationCodeConfig config = new VerificationCodeConfig();
        config.setSecret(secret);
        return new VerificationCodeHasher(config);
    }

    @Test
    @DisplayName("gives the same hash for the same code, and different ones for different codes")
    void shouldBeDeterministic() {
        VerificationCodeHasher hasher = hasher(SECRET);

        assertThat(hasher.hash("12345")).isEqualTo(hasher.hash("12345")).hasSize(64);
        assertThat(hasher.hash("12345")).isNotEqualTo(hasher.hash("12346"));
    }

    @Test
    @DisplayName("can't be reproduced without the secret, unlike a plain SHA-256")
    void shouldDependOnSecret() throws Exception {
        String keyed = hasher(SECRET).hash("12345");

        assertThat(keyed).isNotEqualTo(TokenHasher.sha256Hex("12345"));
        assertThat(keyed)
                .isNotEqualTo(
                        hasher(base64("another-32-byte-or-longer-secret-value")).hash("12345"));
    }

    @Test
    @DisplayName("fails at startup when the secret is missing or shorter than 32 bytes")
    void shouldRejectShortSecret() {
        assertThatThrownBy(() -> hasher(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 bytes");
        assertThatThrownBy(() -> hasher(base64("too-short")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 bytes");
    }

    @Test
    @DisplayName("fails at startup on a non-Base64 secret, without echoing it")
    void shouldRejectNonBase64Secret() {
        assertThatThrownBy(() -> hasher("not base64 !!! secret-value"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("VERIFICATION_CODE_SECRET must be Base64")
                .hasNoCause();
    }
}
