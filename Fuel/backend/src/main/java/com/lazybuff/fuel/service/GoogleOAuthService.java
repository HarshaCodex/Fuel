package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.OAuthGoogleRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.security.ClientInfo;
import com.lazybuff.fuel.security.GoogleIdTokenVerifier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Signs users in (or up) with a Google ID token obtained by the client app. */
@Service
@RequiredArgsConstructor
public class GoogleOAuthService {

    private final GoogleIdTokenVerifier googleIdTokenVerifier;

    private final OAuthAccountService oAuthAccountService;

    /**
     * Verifies the Google ID token, then signs in, links or creates the account (ADR 0001).
     *
     * @throws com.lazybuff.fuel.exception.FuelException 401 for an invalid token, 409 when the
     *     account is linked to a different Google account, 503 if Google's keys can't be fetched
     */
    @NoLogging
    public ApiResponse<UserData> authenticate(
            OAuthGoogleRequest oAuthGoogleRequest, ClientInfo clientInfo) throws Exception {

        return oAuthAccountService.signIn(
                googleIdTokenVerifier.verify(oAuthGoogleRequest.getIdToken()), clientInfo);
    }
}
