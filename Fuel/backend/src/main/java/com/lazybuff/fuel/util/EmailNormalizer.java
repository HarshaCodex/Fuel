package com.lazybuff.fuel.util;

import java.util.Locale;

/**
 * Canonical form for email addresses: trimmed and lower-cased.
 *
 * <p>Emails are treated as case-insensitive, so every write and lookup goes through this; the
 * {@code chk_users_email_lowercase} constraint (V8) guarantees only this form is stored.
 */
public final class EmailNormalizer {

    private EmailNormalizer() {}

    /** Returns {@code null} for {@code null} so callers can pass optional values through. */
    public static String normalize(String email) {
        return email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
