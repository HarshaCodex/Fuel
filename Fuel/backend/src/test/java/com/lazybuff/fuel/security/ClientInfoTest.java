package com.lazybuff.fuel.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;

@DisplayName("ClientInfo")
class ClientInfoTest {

    private static final String USER_AGENT = "Fuel/1.0 (iPhone; iOS 19.0)";
    private static final String CLIENT_IP = "203.0.113.42";

    private static MockHttpServletRequest request(String userAgent) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(CLIENT_IP);
        if (userAgent != null) {
            request.addHeader(HttpHeaders.USER_AGENT, userAgent);
        }
        return request;
    }

    @Test
    @DisplayName("captures the User-Agent and client IP")
    void shouldCaptureUserAgentAndIp() {
        ClientInfo clientInfo = ClientInfo.from(request(USER_AGENT));

        assertThat(clientInfo).isEqualTo(new ClientInfo(USER_AGENT, CLIENT_IP));
    }

    @Test
    @DisplayName("leaves device info null when no User-Agent is sent")
    void shouldReturnNullDeviceInfoWhenUserAgentMissing() {
        assertThat(ClientInfo.from(request(null)).deviceInfo()).isNull();
    }

    @Test
    @DisplayName("treats a blank User-Agent as missing")
    void shouldReturnNullDeviceInfoWhenUserAgentBlank() {
        assertThat(ClientInfo.from(request("   ")).deviceInfo()).isNull();
    }

    @Test
    @DisplayName("truncates a User-Agent longer than the column to 255 characters")
    void shouldTruncateLongUserAgent() {
        String deviceInfo = ClientInfo.from(request("x".repeat(1000))).deviceInfo();

        assertThat(deviceInfo).hasSize(255);
    }
}
