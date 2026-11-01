package com.lazybuff.fuel.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;

/**
 * Where a request came from, recorded on each refresh token (session) for a future "manage
 * sessions" view.
 *
 * @param deviceInfo the client's User-Agent, truncated to fit {@code refresh_tokens.device_info};
 *     {@code null} if absent
 * @param ipAddress the client IP; behind a trusted proxy this is the forwarded client address (see
 *     {@code server.forward-headers-strategy})
 */
public record ClientInfo(String deviceInfo, String ipAddress) {

    private static final int MAX_DEVICE_INFO_LENGTH = 255;

    private static final int MAX_IP_ADDRESS_LENGTH = 45;

    public static ClientInfo from(HttpServletRequest request) {
        return new ClientInfo(
                truncate(request.getHeader(HttpHeaders.USER_AGENT), MAX_DEVICE_INFO_LENGTH),
                truncate(request.getRemoteAddr(), MAX_IP_ADDRESS_LENGTH));
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String stripped = value.strip();
        return stripped.length() > maxLength ? stripped.substring(0, maxLength) : stripped;
    }
}
