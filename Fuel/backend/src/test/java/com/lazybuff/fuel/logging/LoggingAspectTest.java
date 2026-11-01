package com.lazybuff.fuel.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.Signature;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
@DisplayName("LoggingAspect")
class LoggingAspectTest {

    private static final String EMAIL = "jane@example.com";
    private static final String CODE = "48213";
    private static final String REFRESH_TOKEN = "raw-refresh-token-value";

    @Mock private ProceedingJoinPoint joinPoint;
    @Mock private Signature signature;

    private final LoggingAspect aspect = new LoggingAspect();

    @BeforeEach
    void setUp() {
        when(joinPoint.getSignature()).thenReturn(signature);
        when(signature.toShortString()).thenReturn("EmailService.sendEmail(..)");
        // Lenient: the aspect must not read them at all, but if it did they'd be these secrets.
        lenient().when(joinPoint.getArgs()).thenReturn(new Object[] {EMAIL, CODE});
    }

    @Test
    @DisplayName("logs the method and duration but never its arguments or return value")
    void shouldNotLogArgumentsOrResult(CapturedOutput output) throws Throwable {
        when(joinPoint.proceed()).thenReturn(REFRESH_TOKEN);

        Object result = aspect.logPublicMethods(joinPoint);

        assertThat(result).isEqualTo(REFRESH_TOKEN);
        assertThat(output)
                .contains("Starting method execution: EmailService.sendEmail(..)")
                .contains("Completed method execution in");
        // Regression (#84): arguments and results carried codes, tokens and emails.
        assertThat(output).doesNotContain(EMAIL).doesNotContain(CODE).doesNotContain(REFRESH_TOKEN);
    }

    @Test
    @DisplayName("logs and rethrows failures without the arguments")
    void shouldLogFailureWithoutArguments(CapturedOutput output) throws Throwable {
        IllegalStateException failure = new IllegalStateException("boom");
        when(joinPoint.proceed()).thenThrow(failure);

        assertThatThrownBy(() -> aspect.logPublicMethods(joinPoint)).isSameAs(failure);

        assertThat(output).contains("Method execution failed after");
        assertThat(output).doesNotContain(EMAIL).doesNotContain(CODE);
    }
}
