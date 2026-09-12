package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.LoginReqeust;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.entity.UserAuthProvider;
import com.lazybuff.fuel.entity.UserGoals;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserAuthProviderRepository;
import com.lazybuff.fuel.repository.UserGoalsRepository;
import com.lazybuff.fuel.repository.UserRepository;
import com.lazybuff.fuel.util.AuthProvider;
import java.security.NoSuchAlgorithmException;
import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;

    private final UserAuthProviderRepository userAuthProviderRepository;

    private final UserGoalsRepository userGoalsRepository;

    private final PasswordEncoder passwordEncoder;

    private final RefreshTokenService refreshTokenService;

    private final JwtService jwtService;

    private final JwtConfig jwtConfig;

    private final VerificationCodeService verificationCodeService;

    @Transactional
    @NoLogging
    public ApiResponse<UserData> register(UserRegisterRequest userRegisterRequest)
            throws Exception {

        try {

            if (isUserExists(userRegisterRequest.getEmail())) {
                throw new FuelException(HttpStatus.CONFLICT, "Email already exists");
            }

            User user = saveUser(userRegisterRequest);

            saveUserAuthProvider(userRegisterRequest, user);

            saveUserGoals(user);

            sendVerificationCode(user);

            UserData userData =
                    UserData.builder()
                            .userId(user.getId().toString())
                            .email(user.getEmail())
                            .name(user.getName())
                            .emailVerified(user.isEmailVerified())
                            .accessToken(
                                    jwtService.generateToken(
                                            user.getId().toString(), user.getEmail()))
                            .refreshToken(refreshTokenService.issueRefreshToken(user, null, null))
                            .accessTokenExpiresIn(jwtConfig.getAccessTokenExpirySeconds())
                            .refreshTokenExpiresIn(jwtConfig.getRefreshTokenExpirySeconds())
                            .build();

            return ApiResponse.<UserData>builder()
                    .status(HttpStatus.CREATED.value())
                    .message("Registration successful. Verification email sent.")
                    .data(userData)
                    .timestamp(LocalDateTime.now())
                    .build();

        } catch (Exception ex) {
            log.error(
                    "Exception while registering the user with email: {}, exception:",
                    userRegisterRequest.getEmail(),
                    ex);
            throw ex;
        }
    }

    @NoLogging
    public ApiResponse<UserData> login(LoginReqeust loginReqeust) throws Exception {

        try {

            if (isUserExists(loginReqeust.getEmail())) {

                User user = userRepository.findByEmailAndDeletedAtIsNull(loginReqeust.getEmail());

                UserAuthProvider userAuthProvider =
                        userAuthProviderRepository.findByUser_IdAndProvider(
                                user, AuthProvider.EMAIL);

                if (userRepository == null) {
                    throw new FuelException(HttpStatus.UNAUTHORIZED, "Invalid email or password!");
                }

                if (!passwordEncoder.matches(
                        loginReqeust.getPassword(), userAuthProvider.getPasswordHash())) {
                    throw new FuelException(HttpStatus.UNAUTHORIZED, "Invalid email or password!");
                }

                UserData userData =
                        UserData.builder()
                                .userId(user.getId().toString())
                                .email(user.getEmail())
                                .name(user.getName())
                                .emailVerified(user.isEmailVerified())
                                .accessToken(
                                        jwtService.generateToken(
                                                user.getId().toString(), user.getEmail()))
                                .refreshToken(
                                        refreshTokenService.issueRefreshToken(user, null, null))
                                .accessTokenExpiresIn(jwtConfig.getAccessTokenExpirySeconds())
                                .refreshTokenExpiresIn(jwtConfig.getRefreshTokenExpirySeconds())
                                .build();

                return ApiResponse.<UserData>builder()
                        .status(HttpStatus.OK.value())
                        .message("Login successful.")
                        .data(userData)
                        .timestamp(LocalDateTime.now())
                        .build();

            } else {
                throw new FuelException(HttpStatus.UNAUTHORIZED, "Invalid email or password!");
            }
        } catch (Exception exception) {
            log.error(
                    "Exception during login for user with email: {}, exception:",
                    loginReqeust.getEmail(),
                    exception);
            throw exception;
        }
    }

    private User saveUser(UserRegisterRequest userRegisterRequest) {

        User user =
                User.builder()
                        .email(userRegisterRequest.getEmail())
                        .name(userRegisterRequest.getName())
                        .timezone(resolveTimeZone(userRegisterRequest.getTimezone()))
                        .build();

        return userRepository.save(user);
    }

    private void saveUserAuthProvider(UserRegisterRequest userRegisterRequest, User user) {

        UserAuthProvider userAuthProvider =
                UserAuthProvider.builder()
                        .user(user)
                        .provider(AuthProvider.EMAIL)
                        .passwordHash(hashedPassword(userRegisterRequest.getPassword()))
                        .build();

        userAuthProviderRepository.save(userAuthProvider);
    }

    private void saveUserGoals(User user) {

        UserGoals userGoals = UserGoals.builder().user(user).build();
        userGoalsRepository.save(userGoals);
    }

    private boolean isUserExists(String email) {
        return userRepository.existsByEmailAndDeletedAtIsNull(email);
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
        verificationCodeService.generateVerificationCode(user);
    }
}
