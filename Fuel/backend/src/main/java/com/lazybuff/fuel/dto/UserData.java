package com.lazybuff.fuel.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Builder
public class UserData {

    private String userId;
    private String email;
    private String name;
    private boolean emailVerified;

    /** Only set by OAuth sign-in, so register/login responses are unchanged. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Boolean isNewUser;

    private String accessToken;
    private String refreshToken;
    private long accessTokenExpiresIn;
    private long refreshTokenExpiresIn;
}
