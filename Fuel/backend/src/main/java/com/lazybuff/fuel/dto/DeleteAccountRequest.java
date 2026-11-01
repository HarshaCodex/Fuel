package com.lazybuff.fuel.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;
import java.util.stream.Stream;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * Proof that the account owner is the one deleting the account. Exactly one field must be set: the
 * password for accounts that have one, or a fresh token from re-running Google / Apple sign-in.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"password", "googleIdToken", "appleIdentityToken", "appleAuthorizationCode"})
@EqualsAndHashCode
@Builder
@Schema(
        description =
                "Send exactly one of password, googleIdToken or appleIdentityToken (with"
                        + " appleAuthorizationCode). Accounts with Apple linked must use Apple.")
public class DeleteAccountRequest {

    @Schema(description = "The account's password (email/password accounts).")
    @Size(max = 128, message = "Password is too long.")
    private String password;

    @Schema(description = "A fresh Google ID token for the Google account linked to this user.")
    @Size(max = 4096, message = "ID token is too long.")
    private String googleIdToken;

    @Schema(description = "A fresh Apple identity token for the Apple ID linked to this user.")
    @Size(max = 4096, message = "Identity token is too long.")
    private String appleIdentityToken;

    @Schema(
            description =
                    "The authorization code from the same Apple sign-in as appleIdentityToken."
                            + " Required with it: it's used to revoke the user's Apple tokens.")
    @Size(max = 1024, message = "Authorization code is too long.")
    private String appleAuthorizationCode;

    @JsonIgnore
    @AssertTrue(message = "Provide exactly one of password, googleIdToken or appleIdentityToken.")
    public boolean isExactlyOneConfirmation() {
        return Stream.of(password, googleIdToken, appleIdentityToken)
                        .filter(DeleteAccountRequest::isPresent)
                        .count()
                == 1;
    }

    @JsonIgnore
    @AssertTrue(message = "appleAuthorizationCode must be sent together with appleIdentityToken.")
    public boolean isAppleCodeWithAppleToken() {
        return isPresent(appleIdentityToken) == isPresent(appleAuthorizationCode);
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
