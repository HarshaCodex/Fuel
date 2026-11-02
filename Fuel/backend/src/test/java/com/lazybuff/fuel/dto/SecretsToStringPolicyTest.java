package com.lazybuff.fuel.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.RegexPatternTypeFilter;

/**
 * Guards #91: no DTO may print a password, token, secret or code in {@code toString()}, so a log
 * line or an {@code @LogArguments} on the wrong class can't leak one. Scans the whole package, so
 * new DTOs are covered automatically.
 */
@DisplayName("DTO toString() secrets policy")
class SecretsToStringPolicyTest {

    /** Field names that hold secrets. Case-sensitive "Code" so {@code barcode} isn't matched. */
    private static final Pattern SECRET_FIELD =
            Pattern.compile("(?i:password|token|secret)|Code$|^code$");

    @Test
    @DisplayName("no DTO includes a secret field's value in toString()")
    void shouldKeepSecretsOutOfToString() throws Exception {
        List<String> checkedFields = new ArrayList<>();

        for (Class<?> dto : dtoClasses()) {
            Constructor<?> constructor = noArgConstructor(dto);
            if (constructor == null) {
                continue;
            }
            Object instance = constructor.newInstance();
            List<Field> secretFields = new ArrayList<>();

            for (Field field : dto.getDeclaredFields()) {
                if (field.getType() == String.class && !Modifier.isStatic(field.getModifiers())) {
                    field.setAccessible(true);
                    field.set(instance, marker(dto, field));
                    if (SECRET_FIELD.matcher(field.getName()).find()) {
                        secretFields.add(field);
                    }
                }
            }

            String printed = instance.toString();
            for (Field field : secretFields) {
                assertThat(printed)
                        .as(
                                "%s.toString() must not include %s",
                                dto.getSimpleName(), field.getName())
                        .doesNotContain(marker(dto, field));
                checkedFields.add(dto.getSimpleName() + "." + field.getName());
            }
        }

        // Fails if the scan silently stops finding classes, which would make this test vacuous.
        assertThat(checkedFields)
                .contains(
                        "LoginReqeust.password",
                        "UserRegisterRequest.password",
                        "ResetPasswordRequest.newPassword",
                        "ResetPasswordRequest.resetCode",
                        "VerifyEmailRequest.verificationCode",
                        "RefreshTokenRequest.refreshToken",
                        "LogoutRequest.refreshToken",
                        "UserData.accessToken",
                        "UserData.refreshToken",
                        "RefreshTokenResponse.accessToken",
                        "RefreshTokenResponse.refreshToken",
                        "OAuthGoogleRequest.idToken",
                        "OAuthAppleRequest.identityToken",
                        "OAuthAppleRequest.authorizationCode",
                        "DeleteAccountRequest.password",
                        "DeleteAccountRequest.appleAuthorizationCode");
    }

    private static String marker(Class<?> dto, Field field) {
        return "VALUE-OF-" + dto.getSimpleName() + "-" + field.getName();
    }

    private static Constructor<?> noArgConstructor(Class<?> type) {
        try {
            Constructor<?> constructor = type.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor;
        } catch (NoSuchMethodException exception) {
            return null;
        }
    }

    private static List<Class<?>> dtoClasses() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false) {
                    @Override
                    protected boolean isCandidateComponent(
                            org.springframework.beans.factory.annotation.AnnotatedBeanDefinition
                                    definition) {
                        return definition.getMetadata().isConcrete();
                    }
                };
        scanner.addIncludeFilter(new RegexPatternTypeFilter(Pattern.compile(".*")));

        List<Class<?>> classes = new ArrayList<>();
        for (BeanDefinition definition :
                scanner.findCandidateComponents(SecretsToStringPolicyTest.class.getPackageName())) {
            Class<?> type = Class.forName(definition.getBeanClassName());
            // Lombok builders print every field regardless of @ToString.Exclude; they only exist
            // while an object is being built and are never passed around or logged.
            if (!type.getName().contains("Test") && !type.getSimpleName().endsWith("Builder")) {
                classes.add(type);
            }
        }
        return classes;
    }
}
