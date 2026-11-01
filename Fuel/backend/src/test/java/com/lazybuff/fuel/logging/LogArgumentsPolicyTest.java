package com.lazybuff.fuel.logging;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.annotation.LogArguments;
import com.lazybuff.fuel.scheduler.DeletedAccountPurge;
import com.lazybuff.fuel.scheduler.RefreshTokenCleanUp;
import com.lazybuff.fuel.service.AppleOAuthService;
import com.lazybuff.fuel.service.AuthService;
import com.lazybuff.fuel.service.EmailService;
import com.lazybuff.fuel.service.GoogleOAuthService;
import com.lazybuff.fuel.service.JwtService;
import com.lazybuff.fuel.service.OAuthAccountService;
import com.lazybuff.fuel.service.RateLimiterService;
import com.lazybuff.fuel.service.RefreshTokenService;
import com.lazybuff.fuel.service.UserService;
import com.lazybuff.fuel.service.VerificationCodeService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Guards #84: services whose arguments carry passwords, codes, tokens or emails must never opt in
 * to argument logging.
 */
@DisplayName("@LogArguments policy")
class LogArgumentsPolicyTest {

    private static final List<Class<?>> SENSITIVE_CLASSES =
            List.of(
                    AuthService.class,
                    OAuthAccountService.class,
                    GoogleOAuthService.class,
                    AppleOAuthService.class,
                    VerificationCodeService.class,
                    EmailService.class,
                    RefreshTokenService.class,
                    JwtService.class,
                    RateLimiterService.class,
                    UserService.class,
                    DeletedAccountPurge.class,
                    RefreshTokenCleanUp.class);

    @Test
    @DisplayName("auth, account and email services don't log their arguments")
    void sensitiveServicesMustNotLogArguments() {
        assertThat(SENSITIVE_CLASSES)
                .allSatisfy(
                        type ->
                                assertThat(type.isAnnotationPresent(LogArguments.class))
                                        .as("%s must not be @LogArguments", type.getSimpleName())
                                        .isFalse());
    }
}
