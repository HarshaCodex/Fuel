package com.lazybuff.fuel.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.lazybuff.fuel.logging.RequestIdFilter;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@DisplayName("AsyncConfig")
class AsyncConfigTest {

    private ThreadPoolTaskExecutor executor;

    @AfterEach
    void tearDown() {
        MDC.clear();
        if (executor != null) {
            executor.shutdown();
        }
    }

    @Test
    @DisplayName("email executor runs tasks with the submitting request's ID")
    void shouldPropagateRequestIdToEmailExecutorThread() throws Exception {
        executor = (ThreadPoolTaskExecutor) new AsyncConfig().emailTaskExecutor();
        MDC.put(RequestIdFilter.MDC_KEY, "req-123456");
        final AtomicReference<String> seen = new AtomicReference<>();
        final CountDownLatch done = new CountDownLatch(1);

        executor.execute(
                () -> {
                    seen.set(MDC.get(RequestIdFilter.MDC_KEY));
                    done.countDown();
                });

        assertThat(done.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(seen.get()).isEqualTo("req-123456");
    }
}
