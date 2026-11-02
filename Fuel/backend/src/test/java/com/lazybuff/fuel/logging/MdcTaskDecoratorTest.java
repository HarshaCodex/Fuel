package com.lazybuff.fuel.logging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

@DisplayName("MdcTaskDecorator")
class MdcTaskDecoratorTest {

    private final MdcTaskDecorator decorator = new MdcTaskDecorator();

    // One worker thread, like a busy pool, so leaks between tasks would show up.
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    @AfterEach
    void tearDown() {
        MDC.clear();
        worker.shutdownNow();
    }

    private String requestIdSeenBy(final Runnable decorated, final AtomicReference<String> seen)
            throws Exception {
        final Future<?> done = worker.submit(decorated);
        done.get();
        return seen.get();
    }

    @Test
    @DisplayName("runs the task with the submitting request's ID")
    void shouldCopyContextToWorker() throws Exception {
        MDC.put(RequestIdFilter.MDC_KEY, "req-123456");
        final AtomicReference<String> seen = new AtomicReference<>();

        final Runnable task = decorator.decorate(() -> seen.set(MDC.get(RequestIdFilter.MDC_KEY)));

        assertThat(requestIdSeenBy(task, seen)).isEqualTo("req-123456");
    }

    @Test
    @DisplayName("doesn't let one task's ID leak into the next task on the same thread")
    void shouldNotLeakBetweenTasks() throws Exception {
        MDC.put(RequestIdFilter.MDC_KEY, "req-first-1");
        final Runnable first = decorator.decorate(() -> {});
        worker.submit(first).get();

        MDC.clear();
        final AtomicReference<String> seen = new AtomicReference<>("not run");
        final Runnable second =
                decorator.decorate(() -> seen.set(MDC.get(RequestIdFilter.MDC_KEY)));

        assertThat(requestIdSeenBy(second, seen)).isNull();
    }

    @Test
    @DisplayName("restores the worker thread's own context afterwards")
    void shouldRestoreWorkerContext() throws Exception {
        worker.submit(() -> MDC.setContextMap(Map.of("worker", "own"))).get();
        MDC.put(RequestIdFilter.MDC_KEY, "req-123456");

        worker.submit(decorator.decorate(() -> {})).get();
        final AtomicReference<Map<String, String>> after = new AtomicReference<>();
        worker.submit(() -> after.set(MDC.getCopyOfContextMap())).get();

        assertThat(after.get()).containsExactly(Map.entry("worker", "own"));
    }
}
