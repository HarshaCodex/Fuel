package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
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

    @Schema(
            description =
                    "IANA timezone id, e.g. Asia/Kolkata. Used only when a new account is created;"
                            + " defaults to UTC when omitted.",
            example = "Asia/Kolkata")
    @Size(max = 50, message = "Timezone must be at most 50 characters.")
    private String timezone;
}
