package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.config.RateLimitConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.LoginReqeust;
import com.lazybuff.fuel.dto.LogoutRequest;
import com.lazybuff.fuel.dto.RefreshTokenRequest;
import com.lazybuff.fuel.dto.RefreshTokenResponse;
import com.lazybuff.fuel.dto.ResetPasswordRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.dto.VerifyEmailRequest;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.entity.UserGoals;
import com.lazybuff.fuel.entity.VerificationCode;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.RefreshTokenRepository;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.security.ClientInfo;
import com.lazybuff.fuel.util.AuthProvider;
import com.lazybuff.fuel.util.EmailNormalizer;
import com.lazybuff.fuel.util.VerifyType;
import java.security.NoSuchAlgorithmException;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private final RefreshTokenRepository refreshTokenRepository;

    private final UserRepository userRepository;

    private final UserAuthProviderRepository userAuthProviderRepository;

    private final UserGoalsRepository userGoalsRepository;

    private final PasswordEncoder passwordEncoder;

    private final RefreshTokenService refreshTokenService;

    private final JwtService jwtService;

    private final JwtConfig jwtConfig;

    private final VerificationCodeService verificationCodeService;

    private final EmailService emailService;

    private final RateLimiterService rateLimiterService;

    private final RateLimitConfig rateLimitConfig;

    private static final String REGISTER_MESSAGE =
            "Check your email to finish signing up. If you already have an account, we've sent"
                    + " you a reminder instead.";

    private volatile String dummyPasswordHash;

    /**
     * Starts a sign-up. The response is the same whether or not the email is taken, so it can't be
     * used to find out who has an account (#86, ADR 0003): a new email gets an account and a
     * verification code, a taken one gets a notice sent to its owner. The user signs in by
     * verifying the code ({@link #verifyEmail}).
     */
    @Transactional
    @NoLogging
    public ApiResponse<Void> register(UserRegisterRequest userRegisterRequest) throws Exception {

        try {

            // Validated and hashed before the existence check so both paths take the same time.
            String timezone = resolveTimeZone(userRegisterRequest.getTimezone());
            String passwordHash = hashedPassword(userRegisterRequest.getPassword());

            User existingUser =
                    userRepository.findByEmailAndDeletedAtIsNull(
                            EmailNormalizer.normalize(userRegisterRequest.getEmail()));

            if (existingUser != null) {
                notifyExistingAccount(existingUser);
            } else {
                User user = saveUser(userRegisterRequest, timezone);
                saveUserAuthProvider(user, passwordHash);
                saveUserGoals(user);
                sendVerificationCode(user);
            }

            return ApiResponse.<Void>builder()
                    .status(HttpStatus.ACCEPTED.value())
                    .message(REGISTER_MESSAGE)
                    .timestamp(LocalDateTime.now())
                    .build();

        } catch (Exception ex) {
            log.error("Exception while registering a user: {}", ex.getClass().getSimpleName());
            throw ex;
        }
    }

    /**
     * Verifies the email with the emailed code and signs the user in, completing a sign-up.
     *
     * @throws FuelException 401 when the code is wrong or expired, the email is unknown or already
     *     verified (all look the same, see {@link VerificationCodeService#confirmEmail})
     */
    @Transactional
    @NoLogging
    public ApiResponse<UserData> verifyEmail(
            VerifyEmailRequest verifyEmailRequest, ClientInfo clientInfo) throws Exception {

        User user = verificationCodeService.confirmEmail(verifyEmailRequest);

        return ApiResponse.<UserData>builder()
                .status(HttpStatus.OK.value())
                .message("Email verified successfully")
                .data(signIn(user, clientInfo))
                .timestamp(LocalDateTime.now())
                .build();
    }

    @NoLogging
    public ApiResponse<UserData> login(LoginReqeust loginReqeust, ClientInfo clientInfo)
            throws Exception {

        try {

            User user =
                    userRepository.findByEmailAndDeletedAtIsNull(
                            EmailNormalizer.normalize(loginReqeust.getEmail()));

            UserAuthProvider userAuthProvider =
                    user == null
                            ? null
                            : userAuthProviderRepository.findByUser_IdAndProvider(
                                    user.getId(), AuthProvider.EMAIL);

            // Always run bcrypt, against a dummy hash when there's no password to check, so an
            // unknown email takes as long as a wrong password (#86).
            boolean passwordMatches =
                    passwordEncoder.matches(
                            loginReqeust.getPassword(),
                            userAuthProvider == null
                                    ? dummyPasswordHash()
                                    : userAuthProvider.getPasswordHash());

            if (userAuthProvider == null || !passwordMatches) {
                throw new FuelException(HttpStatus.UNAUTHORIZED, "Invalid email or password!");
            }

            if (!user.isEmailVerified()) {
                // Only reachable with the right password, so it reveals nothing to a stranger.
                throw new FuelException(
                        HttpStatus.FORBIDDEN, "Please verify your email before logging in.");
            }

            UserData userData = signIn(user, clientInfo);

            return ApiResponse.<UserData>builder()
                    .status(HttpStatus.OK.value())
                    .message("Login successful.")
                    .data(userData)
                    .timestamp(LocalDateTime.now())
                    .build();

        } catch (Exception exception) {
            log.error("Exception during login, exception:", exception);
            throw exception;
        }
    }

    @NoLogging
    public ApiResponse<Void> logout(LogoutRequest logoutRequest) throws Exception {

        try {

            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            UUID userId = UUID.fromString(authentication.getPrincipal().toString());

            refreshTokenService.revokeForUser(logoutRequest.getRefreshToken(), userId);

            return ApiResponse.<Void>builder()
                    .status(HttpStatus.OK.value())
                    .message("Logout successful.")
                    .timestamp(LocalDateTime.now())
                    .build();

        } catch (Exception exception) {
            log.error("Exception while logging out, exception:", exception);
            throw exception;
        }
    }

    @Transactional
    @NoLogging
    public ApiResponse<Void> resetPassword(ResetPasswordRequest resetPasswordRequest)
            throws Exception {

        try {

            User user =
                    userRepository.findByEmailAndDeletedAtIsNull(
                            EmailNormalizer.normalize(resetPasswordRequest.getEmail()));

            if (user == null) {
                throw new FuelException(
                        HttpStatus.UNAUTHORIZED, "Invalid or expired verification code");
            }

            VerificationCode code =
                    verificationCodeService.findValidCode(
                            user, VerifyType.PASSWORD_RESET, resetPasswordRequest.getResetCode());

            String passwordHash = hashedPassword(resetPasswordRequest.getNewPassword());

            UserAuthProvider userAuthProvider =
                    userAuthProviderRepository.findByUser_IdAndProvider(
                            user.getId(), AuthProvider.EMAIL);

            if (userAuthProvider == null) {
                // Google-only account: the emailed code proves inbox ownership, so add a password
                // login next to Google (ADR 0001).
                userAuthProviderRepository.save(
                        UserAuthProvider.builder()
                                .user(user)
                                .provider(AuthProvider.EMAIL)
                                .passwordHash(passwordHash)
                                .build());
                log.info("Added email/password login to user {} via password reset", user.getId());
            } else {
                userAuthProvider.setPasswordHash(passwordHash);
            }

            code.setUsedAt(Instant.now());
            // The emailed code proves the user owns the inbox. Resetting also replaces the
            // password of anyone who registered this email without owning it (#86).
            user.setEmailVerified(true);

            refreshTokenRepository.deleteByUser_Id(user.getId());

            return ApiResponse.<Void>builder()
                    .status(HttpStatus.OK.value())
                    .message("Password reset successful. Please log in with your new password.")
                    .build();

        } catch (Exception exception) {
            log.error("Exception while resetting password: ", exception);
            throw exception;
        }
    }

    @Transactional
    @NoLogging
    public ApiResponse<RefreshTokenResponse> refreshToken(
            RefreshTokenRequest refreshTokenRequest, ClientInfo clientInfo) throws Exception {

        try {

            UUID callerUserId = resolveAuthenticatedUserId();

            User user =
                    refreshTokenService.rotate(refreshTokenRequest.getRefreshToken(), callerUserId);

            RefreshTokenResponse response =
                    RefreshTokenResponse.builder()
                            .accessToken(
                                    jwtService.generateToken(
                                            user.getId().toString(), user.getEmail()))
                            .refreshToken(
                                    refreshTokenService.issueRefreshToken(
                                            user, clientInfo.deviceInfo(), clientInfo.ipAddress()))
                            .accessTokenExpiresIn(jwtConfig.getAccessTokenExpirySeconds())
                            .refreshTokenExpiresIn(jwtConfig.getRefreshTokenExpirySeconds())
                            .build();

            return ApiResponse.<RefreshTokenResponse>builder()
                    .status(HttpStatus.OK.value())
                    .message("Token refreshed")
                    .data(response)
                    .build();

        } catch (Exception exception) {
            log.error("Exception occurred while refreshing token: ", exception);
            throw exception;
        }
    }

    private UUID resolveAuthenticatedUserId() {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }

        try {
            return UUID.fromString(authentication.getPrincipal().toString());
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private UserData signIn(User user, ClientInfo clientInfo) throws Exception {
        return UserData.builder()
                .userId(user.getId().toString())
                .email(user.getEmail())
                .name(user.getName())
                .emailVerified(user.isEmailVerified())
                .accessToken(jwtService.generateToken(user.getId().toString(), user.getEmail()))
                .refreshToken(
                        refreshTokenService.issueRefreshToken(
                                user, clientInfo.deviceInfo(), clientInfo.ipAddress()))
                .accessTokenExpiresIn(jwtConfig.getAccessTokenExpirySeconds())
                .refreshTokenExpiresIn(jwtConfig.getRefreshTokenExpirySeconds())
                .build();
    }

    /** Tells the owner someone tried to sign up with their email; silently capped per account. */
    private void notifyExistingAccount(User user) {
        // Keyed by user id so no email is stored in Redis. Over the limit, skip the email rather
        // than return 429, which would reveal the account exists.
        if (rateLimiterService.isAllowed(
                "rate_limit:account-exists-notice:" + user.getId(),
                rateLimitConfig.getMaxRequests(),
                rateLimitConfig.getWindow())) {
            emailService.sendAccountExistsEmail(user.getEmail());
        }
    }

    /** A real bcrypt hash to compare against when there's none, created on first use. */
    private String dummyPasswordHash() {
        String hash = dummyPasswordHash;
        if (hash == null) {
            hash = passwordEncoder.encode(UUID.randomUUID().toString());
            dummyPasswordHash = hash;
        }
        return hash;
    }

    private User saveUser(UserRegisterRequest userRegisterRequest, String timezone) {

        User user =
                User.builder()
                        .email(EmailNormalizer.normalize(userRegisterRequest.getEmail()))
                        .name(userRegisterRequest.getName())
                        .timezone(timezone)
                        .build();

        return userRepository.save(user);
    }

    private void saveUserAuthProvider(User user, String passwordHash) {

        UserAuthProvider userAuthProvider =
                UserAuthProvider.builder()
                        .user(user)
                        .provider(AuthProvider.EMAIL)
                        .passwordHash(passwordHash)
                        .build();

        userAuthProviderRepository.save(userAuthProvider);
    }

    private void saveUserGoals(User user) {

        UserGoals userGoals = UserGoals.builder().user(user).build();
        userGoalsRepository.save(userGoals);
    }

    private String resolveTimeZone(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return "UTC";
        }
        try {
            // Normalises to the canonical IANA id (e.g. trims and validates "Asia/Kolkata").
            return ZoneId.of(timezone).getId();
        } catch (DateTimeException e) {
            throw new FuelException(HttpStatus.BAD_REQUEST, "Invalid timezone: " + timezone);
        }
    }

    private String hashedPassword(String password) {
        return passwordEncoder.encode(password);
    }

    private void sendVerificationCode(User user) throws NoSuchAlgorithmException {
        verificationCodeService.generateVerificationCode(user, VerifyType.EMAIL_VERIFY);
    }
}
