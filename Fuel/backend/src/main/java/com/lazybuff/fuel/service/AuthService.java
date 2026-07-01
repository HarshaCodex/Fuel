package com.lazybuff.fuel.service;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.dto.UserRegisterRequest;
import com.lazybuff.fuel.entity.User;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;

    public ApiResponse<UserData> register(UserRegisterRequest userRegisterRequest) {

        userRepository
                .findByEmailAndDeletedAtIsNull(userRegisterRequest.getEmail())
                .ifPresent(
                        user -> {
                            throw new FuelException(HttpStatus.CONFLICT, "Email already exists");
                        });

        User user =
                User.builder()
                        .email(userRegisterRequest.getEmail())
                        .name(userRegisterRequest.getName())
                        .build();

        userRepository.save(user);

        return ApiResponse.<UserData>builder().status(HttpStatus.OK.value()).data(null).build();
    }
}
