package com.lazybuff.fuel.logging;

import com.lazybuff.fuel.annotation.LogArguments;
import java.util.Arrays;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;

/**
 * Logs entry, duration and failures of public service and scheduler methods.
 *
 * <p>Arguments are only logged for classes annotated {@link LogArguments}; return values never are.
 * Auth arguments and results include verification codes, refresh tokens and personal data (#84), so
 * logging is opt-in and a new class is safe by default. Methods annotated {@code @NoLogging} are
 * skipped entirely.
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

        if (logsArguments(joinPoint)) {
            log.info(
                    "Starting method execution: {} | Request: {}",
                    methodName,
                    Arrays.toString(joinPoint.getArgs()));
        } else {
            log.info("Starting method execution: {}", methodName);
        }

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

    private static boolean logsArguments(ProceedingJoinPoint joinPoint) {
        return AnnotatedElementUtils.hasAnnotation(
                joinPoint.getSignature().getDeclaringType(), LogArguments.class);
    }
}
