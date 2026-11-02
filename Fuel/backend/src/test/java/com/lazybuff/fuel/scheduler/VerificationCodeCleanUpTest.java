package com.lazybuff.fuel.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import com.lazybuff.fuel.repository.VerificationCodeRepository;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("VerificationCodeCleanUp")
class VerificationCodeCleanUpTest {

    @Mock private VerificationCodeRepository verificationCodeRepository;

    @InjectMocks private VerificationCodeCleanUp cleanUp;

    @Test
    @DisplayName("deletes used and expired codes as of now")
    void shouldDeleteUnusableCodes() {
        Instant before = Instant.now();

        cleanUp.deleteUnusableCodes();

        ArgumentCaptor<Instant> now = ArgumentCaptor.forClass(Instant.class);
        verify(verificationCodeRepository).deleteUsedOrExpired(now.capture());
        assertThat(now.getValue()).isBetween(before, Instant.now());
    }
}
