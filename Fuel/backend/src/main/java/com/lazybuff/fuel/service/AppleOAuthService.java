package com.lazybuff.fuel.service;

import com.lazybuff.fuel.annotation.NoLogging;
import com.lazybuff.fuel.dto.ApiResponse;
import com.lazybuff.fuel.dto.OAuthAppleRequest;
import com.lazybuff.fuel.dto.UserData;
import com.lazybuff.fuel.security.AppleIdTokenVerifier;
import com.lazybuff.fuel.security.ClientInfo;
import com.lazybuff.fuel.security.OAuthIdentity;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Signs users in (or up) with a Sign in with Apple identity token obtained by the client app. */
@Service
@RequiredArgsConstructor
public class AppleOAuthService {

    private final AppleIdTokenVerifier appleIdTokenVerifier;

    private final OAuthAccountService oAuthAccountService;

    /**
     * Verifies the Apple identity token, then signs in, links or creates the account (ADR 0001).
     *
     * <p>Apple never puts the user's name in the token and only gives it to the app on the first
     * sign-in, so the name comes from the request and is only used when a new account is created.
     *
     * @throws com.lazybuff.fuel.exception.FuelException 401 for an invalid token, 400 when Apple
     *     shared no email for a new account, 409 when the account is linked to a different Apple
     *     account, 503 if Apple's keys can't be fetched
     */
    @NoLogging
    public ApiResponse<UserData> authenticate(
            OAuthAppleRequest oAuthAppleRequest, ClientInfo clientInfo) throws Exception {

        OAuthIdentity verified = appleIdTokenVerifier.verify(oAuthAppleRequest.getIdentityToken());

        OAuthIdentity identity =
                new OAuthIdentity(
                        verified.provider(),
                        verified.subject(),
                        verified.email(),
                        fullName(oAuthAppleRequest.getFullName()));

        return oAuthAccountService.signIn(identity, clientInfo);
    }

    private static String fullName(OAuthAppleRequest.FullName fullName) {
        if (fullName == null) {
            return null;
        }
        String name =
                Stream.of(fullName.givenName(), fullName.familyName())
                        .filter(Objects::nonNull)
                        .map(String::strip)
                        .filter(part -> !part.isEmpty())
                        .collect(Collectors.joining(" "));
        return name.isEmpty() ? null : name;
    }
}
