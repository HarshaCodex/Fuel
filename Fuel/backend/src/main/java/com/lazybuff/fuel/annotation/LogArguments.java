package com.lazybuff.fuel.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Opts a service class in to having its public methods' arguments logged by {@code LoggingAspect}
 * (return values are never logged).
 *
 * <p>Only put this on classes whose arguments can never carry secrets (passwords, codes, tokens) or
 * personal data such as emails. That rules out the auth, user-account and email services. It is
 * opt-in so a new class is safe by default (#84). Arguments are logged with {@code toString()}, so
 * a DTO argument must not include such fields in it.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogArguments {}
