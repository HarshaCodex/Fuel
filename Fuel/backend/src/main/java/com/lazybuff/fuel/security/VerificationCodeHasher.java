package com.lazybuff.fuel.security;

import com.lazybuff.fuel.config.VerificationCodeConfig;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Hashes emailed verification and reset codes for storage with HMAC-SHA256 and a server secret
 * (#90).
 *
 * <p>Codes are 5 digits, so a plain SHA-256 of one can be reversed by trying all 100,000 values.
 * With a keyed hash, a copy of the database alone reveals nothing; the attacker also needs {@code
 * VERIFICATION_CODE_SECRET}.
 */
@Component
public class VerificationCodeHasher {

    private static final String ALGORITHM = "HmacSHA256";

    private static final int MIN_KEY_BYTES = 32;

    private final SecretKeySpec key;

    public VerificationCodeHasher(VerificationCodeConfig verificationCodeConfig) {
        this.key = parseKey(verificationCodeConfig.getSecret());
    }

    /** Returns the hex HMAC of {@code code}; the same code always gives the same value. */
    public String hash(String code) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            return HexFormat.of().formatHex(mac.doFinal(code.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            // HmacSHA256 is required on every JVM, so this means a broken runtime.
            throw new IllegalStateException("HmacSHA256 unavailable", exception);
        }
    }

    private static SecretKeySpec parseKey(String secret) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(secret == null ? "" : secret.strip());
        } catch (IllegalArgumentException exception) {
            // Don't chain the cause: its message can echo part of the secret.
            throw new IllegalStateException("VERIFICATION_CODE_SECRET must be Base64");
        }
        if (bytes.length < MIN_KEY_BYTES) {
            throw new IllegalStateException(
                    "VERIFICATION_CODE_SECRET must decode to at least "
                            + MIN_KEY_BYTES
                            + " bytes (generate one with: openssl rand -base64 32)");
        }
        return new SecretKeySpec(bytes, ALGORITHM);
    }
}
