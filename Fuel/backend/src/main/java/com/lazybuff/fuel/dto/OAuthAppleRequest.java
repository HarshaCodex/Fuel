package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
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
@ToString(exclude = {"identityToken", "authorizationCode"})
@EqualsAndHashCode
@Builder
public class OAuthAppleRequest {

    @NotBlank(message = "Identity token field cannot be blank.")
    @Size(max = 4096, message = "Identity token is too long.")
    private String identityToken;

    @Schema(
            description =
                    "Apple authorization code. Optional and not used yet; reserved for revoking"
                            + " Apple tokens when the account is deleted.")
    @Size(max = 1024, message = "Authorization code is too long.")
    private String authorizationCode;

    @Schema(
            description =
                    "The user's name. Apple only provides it on the first sign-in, so send it when"
                            + " present; it's ignored for existing accounts.")
    @Valid
    private FullName fullName;

    /** Name parts as returned by Apple's sign-in SDKs. */
    public record FullName(
            @Size(max = 100, message = "Given name is too long.") String givenName,
            @Size(max = 100, message = "Family name is too long.") String familyName) {}
}
