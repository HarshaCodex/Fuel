package com.lazybuff.fuel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
@ToString(exclude = "idToken")
@EqualsAndHashCode
@Builder
public class OAuthGoogleRequest {

    @NotBlank(message = "ID token field cannot be blank.")
    @Size(max = 4096, message = "ID token is too long.")
    private String idToken;
}
