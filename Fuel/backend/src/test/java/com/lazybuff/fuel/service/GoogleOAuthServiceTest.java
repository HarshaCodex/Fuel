package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.OAuthGoogleRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.security.GoogleIdTokenVerifier;
import com.lazybuff.fuel.security.OAuthIdentity;
import com.lazybuff.fuel.util.AuthProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("GoogleOAuthService")
class GoogleOAuthServiceTest {

    private static final String ID_TOKEN = "google.id.token";

    @Mock private GoogleIdTokenVerifier googleIdTokenVerifier;
    @Mock private OAuthAccountService oAuthAccountService;

    private GoogleOAuthService googleOAuthService;

    private final OAuthGoogleRequest request = new OAuthGoogleRequest(ID_TOKEN);

    @BeforeEach
    void setUp() {
        googleOAuthService = new GoogleOAuthService(googleIdTokenVerifier, oAuthAccountService);
    }

    @Test
    @DisplayName("signs in with the identity from the verified Google token")
    void shouldSignInWithVerifiedIdentity() throws Exception {
        OAuthIdentity identity =
                new OAuthIdentity(
                        AuthProvider.GOOGLE, "109876543210", TestDataFactory.EMAIL, "John");
        ApiResponse<UserData> signedIn = ApiResponse.<UserData>builder().status(200).build();
        when(googleIdTokenVerifier.verify(ID_TOKEN)).thenReturn(identity);
        when(oAuthAccountService.signIn(identity, TestDataFactory.CLIENT_INFO))
                .thenReturn(signedIn);

        ApiResponse<UserData> response =
                googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO);

        assertThat(response).isSameAs(signedIn);
    }

    @Test
    @DisplayName("propagates verification failures without signing anyone in")
    void shouldPropagateVerificationFailure() {
        when(googleIdTokenVerifier.verify(ID_TOKEN))
                .thenThrow(new FuelException(HttpStatus.UNAUTHORIZED, "Invalid Google ID token"));

        assertThatThrownBy(
                        () -> googleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO))
                .isInstanceOf(FuelException.class)
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(oAuthAccountService);
    }
}
