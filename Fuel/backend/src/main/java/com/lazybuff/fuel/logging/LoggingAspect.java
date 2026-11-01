package com.lazybuff.fuel.logging;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

/**
 * Logs entry, duration and failures of public service and scheduler methods.
 *
 * <p>Deliberately never logs arguments or return values: they include verification codes, refresh
 * tokens and personal data (see #84), and an opt-out list can't keep up with new methods. Methods
 * annotated {@code @NoLogging} are skipped entirely.
 */
@Slf4j
@Aspect
@Component
public class LoggingAspect {

    @Around(
            "(execution(public * com.lazybuff.fuel.service..*(..)) || execution(public *"
                    + " com.lazybuff.fuel.scheduler..*(..))) &&"
                    + " !@annotation(com.lazybuff.fuel.annotation.NoLogging)")
    public Object logPublicMethods(ProceedingJoinPoint joinPoint) throws Throwable {

        long start = System.currentTimeMillis();

        String methodName = joinPoint.getSignature().toShortString();

        log.info("Starting method execution: {}", methodName);

        try {
            Object result = joinPoint.proceed();

            long timeTaken = System.currentTimeMillis() - start;

            log.info("Completed method execution in {}ms: {}", timeTaken, methodName);

            return result;
        } catch (Throwable ex) {
            long timeTaken = System.currentTimeMillis() - start;

            log.error("Method execution failed after {}ms: {}", timeTaken, methodName, ex);

            throw ex;
        }
    }
}
