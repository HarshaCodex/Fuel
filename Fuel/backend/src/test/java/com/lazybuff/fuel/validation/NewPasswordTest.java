package com.lazybuff.fuel.validation;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.dto.LoginReqeust;
import com.lazybuff.fuel.dto.ResetPasswordRequest;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.dto.VerifyEmailRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@DisplayName("@NewPassword and auth request validation")
class NewPasswordTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static Set<String> passwordErrors(String password) {
        UserRegisterRequest request =
                UserRegisterRequest.builder()
                        .email("john.doe@example.com")
                        .password(password)
                        .name("John")
                        .timezone("UTC")
                        .build();
        return validator.validate(request).stream()
                .filter(v -> v.getPropertyPath().toString().equals("password"))
                .map(ConstraintViolation::getMessage)
                .collect(Collectors.toSet());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "Password1!",
                "correct Horse battery staple 9",
                "Pa#ss-w^rd_1~",
                "Ünïcödé Pässwörd 1",
                "Aa1!aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            })
    @DisplayName("accepts passphrases, any symbols and up to 64 characters")
    void shouldAcceptStrongPasswords(String password) {
        assertThat(passwordErrors(password)).isEmpty();
    }

    @Test
    @DisplayName("rejects more than 64 characters")
    void shouldRejectOver64Characters() {
        assertThat(passwordErrors("Aa1!" + "a".repeat(61)))
                .containsExactly("Password must be between 8 and 64 characters.");
    }

    @Test
    @DisplayName("rejects fewer than 8 characters")
    void shouldRejectUnder8Characters() {
        assertThat(passwordErrors("Aa1!aaa"))
                .containsExactly("Password must be between 8 and 64 characters.");
    }

    @ParameterizedTest
    @ValueSource(strings = {"password1!", "PASSWORD1!", "Password!!", "Password12"})
    @DisplayName("still requires a lowercase letter, uppercase letter, digit and symbol")
    void shouldRequireEachCharacterClass(String password) {
        assertThat(passwordErrors(password))
                .containsExactly(
                        "Password must contain at least one uppercase letter, one lowercase"
                                + " letter, one number, and one symbol");
    }

    @Test
    @DisplayName("rejects 64 characters that are over bcrypt's 72-byte limit")
    void shouldRejectOver72Bytes() {
        // 4 ASCII + 30 two-byte characters = 64 bytes is fine; 40 of them = 84 bytes is not.
        assertThat(passwordErrors("Aa1!" + "é".repeat(30))).isEmpty();
        assertThat(passwordErrors("Aa1!" + "é".repeat(40)))
                .containsExactly("Password is too long. Use fewer emoji or non-Latin characters.");
    }

    @Test
    @DisplayName("applies the same rules to the new password on reset")
    void shouldApplyRulesOnReset() {
        ResetPasswordRequest request =
                ResetPasswordRequest.builder()
                        .email("john.doe@example.com")
                        .resetCode("12345")
                        .newPassword("weak")
                        .build();

        assertThat(validator.validate(request))
                .extracting(v -> v.getPropertyPath().toString())
                .contains("newPassword");
    }

    @Test
    @DisplayName("login accepts any non-blank password up to 128 characters, without the rules")
    void shouldNotApplyRulesAtLogin() {
        LoginReqeust oldStylePassword =
                LoginReqeust.builder().email("john.doe@example.com").password("simple").build();
        LoginReqeust tooLong =
                LoginReqeust.builder()
                        .email("john.doe@example.com")
                        .password("a".repeat(129))
                        .build();

        assertThat(validator.validate(oldStylePassword)).isEmpty();
        assertThat(validator.validate(tooLong))
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("Password must be at most 128 characters.");
    }

    @Test
    @DisplayName("caps the length of submitted codes")
    void shouldCapCodeLength() {
        VerifyEmailRequest verify =
                VerifyEmailRequest.builder()
                        .email("john.doe@example.com")
                        .verificationCode("1".repeat(11))
                        .build();
        ResetPasswordRequest reset =
                ResetPasswordRequest.builder()
                        .email("john.doe@example.com")
                        .resetCode("1".repeat(11))
                        .newPassword("Password1!")
                        .build();

        assertThat(validator.validate(verify))
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("Verification code must be at most 10 characters.");
        assertThat(validator.validate(reset))
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("Reset code must be at most 10 characters.");
    }
}
