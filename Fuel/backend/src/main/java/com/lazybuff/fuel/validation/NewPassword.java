package com.lazybuff.fuel.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Rules for a password being set (register, reset), in one place (#88).
 *
 * <p>8–64 characters of any kind, so passphrases and password-manager output work, with at least
 * one lowercase letter, uppercase letter, digit and symbol (anything that isn't an ASCII letter or
 * digit, including spaces). Capped at 72 UTF-8 bytes because bcrypt ignores the rest and Spring
 * Security refuses to hash longer input. Not used at login, so changing these rules never locks out
 * existing users.
 */
@Documented
@Constraint(validatedBy = {})
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@NotBlank(message = "Password field cannot be blank.")
@Size(min = 8, max = 64, message = "Password must be between 8 and 64 characters.")
@Pattern(
        regexp = "(?s)^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).*$",
        message =
                "Password must contain at least one uppercase letter, one lowercase letter, one"
                        + " number, and one symbol")
@MaxUtf8Bytes(
        value = 72,
        message = "Password is too long. Use fewer emoji or non-Latin characters.")
public @interface NewPassword {

    String message() default "Invalid password";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
