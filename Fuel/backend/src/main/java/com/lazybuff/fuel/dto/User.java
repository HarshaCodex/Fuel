package com.lazybuff.fuel.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class User {

    private String userId;
    private String email;
    private String name;
    private boolean emailVerified;
    private String accessToken;
    private String refreshToken;
    private long accessTokenExpiresIn;
    private long refreshTokenExpiresIn;
}
