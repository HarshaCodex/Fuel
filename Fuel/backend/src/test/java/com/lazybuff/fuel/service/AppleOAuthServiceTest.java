package com.lazybuff.fuel.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.OAuthAppleRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.exception.FuelException;
import com.lazybuff.fuel.security.AppleIdTokenVerifier;
import com.lazybuff.fuel.security.OAuthIdentity;
import com.lazybuff.fuel.util.AuthProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
@DisplayName("AppleOAuthService")
class AppleOAuthServiceTest {

    private static final String IDENTITY_TOKEN = "apple.identity.token";
    private static final String APPLE_SUB = "001234.abcdef0123456789.1234";

    @Mock private AppleIdTokenVerifier appleIdTokenVerifier;
    @Mock private OAuthAccountService oAuthAccountService;

    @Captor private ArgumentCaptor<OAuthIdentity> identityCaptor;

    private AppleOAuthService appleOAuthService;

    @BeforeEach
    void setUp() {
        appleOAuthService = new AppleOAuthService(appleIdTokenVerifier, oAuthAccountService);
    }

    private static OAuthAppleRequest request(OAuthAppleRequest.FullName fullName) {
        return OAuthAppleRequest.builder().identityToken(IDENTITY_TOKEN).fullName(fullName).build();
    }

    /** Signs in with the given request and returns the identity handed to the shared flow. */
    private OAuthIdentity signInWith(OAuthAppleRequest request) throws Exception {
        when(appleIdTokenVerifier.verify(IDENTITY_TOKEN))
                .thenReturn(
                        new OAuthIdentity(
                                AuthProvider.APPLE, APPLE_SUB, TestDataFactory.EMAIL, null));
        when(oAuthAccountService.signIn(any(), any()))
                .thenReturn(ApiResponse.<UserData>builder().status(200).build());

        appleOAuthService.authenticate(request, TestDataFactory.CLIENT_INFO);

        verify(oAuthAccountService).signIn(identityCaptor.capture(), any());
        return identityCaptor.getValue();
    }

    @Test
    @DisplayName("signs in with the verified Apple subject and email")
    void shouldSignInWithVerifiedIdentity() throws Exception {
        OAuthIdentity identity = signInWith(request(null));

        assertThat(identity.provider()).isEqualTo(AuthProvider.APPLE);
        assertThat(identity.subject()).isEqualTo(APPLE_SUB);
        assertThat(identity.email()).isEqualTo(TestDataFactory.EMAIL);
        assertThat(identity.name()).isNull();
    }

    @Test
    @DisplayName("joins the given and family name the app sent on first sign-in")
    void shouldUseFullNameFromRequest() throws Exception {
        OAuthIdentity identity =
                signInWith(request(new OAuthAppleRequest.FullName(" Harsha ", "B")));

        assertThat(identity.name()).isEqualTo("Harsha B");
    }

    @Test
    @DisplayName("uses just the given name when there is no family name")
    void shouldUseGivenNameAlone() throws Exception {
        OAuthIdentity identity =
                signInWith(request(new OAuthAppleRequest.FullName("Harsha", null)));

        assertThat(identity.name()).isEqualTo("Harsha");
    }

    @Test
    @DisplayName("treats a blank name as missing")
    void shouldTreatBlankNameAsMissing() throws Exception {
        OAuthIdentity identity = signInWith(request(new OAuthAppleRequest.FullName(" ", "")));

        assertThat(identity.name()).isNull();
    }

    @Test
    @DisplayName("propagates verification failures without signing anyone in")
    void shouldPropagateVerificationFailure() {
        when(appleIdTokenVerifier.verify(IDENTITY_TOKEN))
                .thenThrow(
                        new FuelException(HttpStatus.UNAUTHORIZED, "Invalid Apple identity token"));

        assertThatThrownBy(
                        () ->
                                appleOAuthService.authenticate(
                                        request(null), TestDataFactory.CLIENT_INFO))
                .isInstanceOf(FuelException.class)
                .extracting(e -> ((FuelException) e).getHttpStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(oAuthAccountService);
    }
}
