package com.lazybuff.fuel.logging;

import java.util.Map;
import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;

/**
 * Carries the submitting thread's logging context (such as the request ID, #108) onto a pooled
 * executor thread, and restores the worker's previous context afterwards so nothing leaks between
 * tasks.
 */
public class MdcTaskDecorator implements TaskDecorator {

    @Override
    public Runnable decorate(final Runnable task) {
        final Map<String, String> submitterContext = MDC.getCopyOfContextMap();
        return () -> {
            final Map<String, String> workerContext = MDC.getCopyOfContextMap();
            setContext(submitterContext);
            try {
                task.run();
            } finally {
                setContext(workerContext);
            }
        };
    }

    private static void setContext(final Map<String, String> context) {
        if (context == null) {
            MDC.clear();
        } else {
            MDC.setContextMap(context);
        }
    }
}
