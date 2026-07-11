package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.config.JwtConfig;
import com.lazybuff.fuel.dto.ApiResponse;
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
                    .build();

        } catch (Exception ex) {
            log.error(
                    "Exception while registering the user with email: {}, exception:",
                    userRegisterRequest.getEmail(),
                    ex);
            throw ex;
        }
    }

    private User saveUser(UserRegisterRequest userRegisterRequest) {

        User user =
                User.builder()
                        .email(userRegisterRequest.getEmail())
                        .name(userRegisterRequest.getName())
                        .timezone(getTimeZone())
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

    private String getTimeZone() {
        return ZoneId.systemDefault().toString();
    }

    private String hashedPassword(String password) {
        return passwordEncoder.encode(password);
    }
}
