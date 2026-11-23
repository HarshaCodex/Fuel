package com.lazybuff.fuel.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

@DisplayName("RequestIdFilter")
class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    private final MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/x");

    private final MockHttpServletResponse response = new MockHttpServletResponse();

    /** Records the request ID visible in the MDC while the rest of the chain runs. */
    private final AtomicReference<String> idSeenDownstream = new AtomicReference<>();

    private final FilterChain recordingChain =
            (req, res) -> idSeenDownstream.set(MDC.get(RequestIdFilter.MDC_KEY));

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    @DisplayName("generates an ID, logs with it and returns it when the caller sends none")
    void shouldGenerateIdWhenHeaderMissing() throws ServletException, IOException {
        filter.doFilter(request, response, recordingChain);

        final String id = response.getHeader(RequestIdFilter.HEADER);
        assertThat(id).isNotBlank();
        assertThat(UUID.fromString(id)).isNotNull();
        assertThat(idSeenDownstream.get()).isEqualTo(id);
    }

    @Test
    @DisplayName("reuses a safe ID sent by the caller")
    void shouldReuseSafeIncomingId() throws ServletException, IOException {
        request.addHeader(RequestIdFilter.HEADER, "app-7f3a9c21.retry_2");

        filter.doFilter(request, response, recordingChain);

        assertThat(response.getHeader(RequestIdFilter.HEADER)).isEqualTo("app-7f3a9c21.retry_2");
        assertThat(idSeenDownstream.get()).isEqualTo("app-7f3a9c21.retry_2");
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "short",
                "abc123\nERROR forged log line",
                "has spaces in it",
                "quote\"injection-1234",
                "0123456789012345678901234567890123456789012345678901234567890123456789"
            })
    @DisplayName("replaces an unsafe or oversized caller ID")
    void shouldReplaceUnsafeIncomingId(final String unsafe) throws ServletException, IOException {
        request.addHeader(RequestIdFilter.HEADER, unsafe);

        filter.doFilter(request, response, recordingChain);

        final String id = response.getHeader(RequestIdFilter.HEADER);
        assertThat(id).isNotEqualTo(unsafe);
        assertThat(UUID.fromString(id)).isNotNull();
        assertThat(idSeenDownstream.get()).isEqualTo(id);
    }

    @Test
    @DisplayName("gives each request its own ID")
    void shouldGiveEachRequestADifferentId() throws ServletException, IOException {
        final MockHttpServletResponse second = new MockHttpServletResponse();

        filter.doFilter(request, response, recordingChain);
        filter.doFilter(new MockHttpServletRequest("GET", "/api/x"), second, recordingChain);

        assertThat(second.getHeader(RequestIdFilter.HEADER))
                .isNotEqualTo(response.getHeader(RequestIdFilter.HEADER));
    }

    @Test
    @DisplayName("removes the ID from the thread once the request is done")
    void shouldClearMdcAfterRequest() throws ServletException, IOException {
        filter.doFilter(request, response, recordingChain);

        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
    }

    @Test
    @DisplayName("removes the ID from the thread even when the request fails")
    void shouldClearMdcWhenChainThrows() {
        final FilterChain failingChain =
                (req, res) -> {
                    throw new IllegalStateException("boom");
                };

        assertThatThrownBy(() -> filter.doFilter(request, response, failingChain))
                .isInstanceOf(IllegalStateException.class);
        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
        assertThat(response.getHeader(RequestIdFilter.HEADER)).isNotBlank();
    }
}
