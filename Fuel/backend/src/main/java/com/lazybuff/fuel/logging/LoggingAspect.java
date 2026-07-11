package com.lazybuff.fuel.logging;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

@Slf4j
@Aspect
@Component
public class LoggingAspect {

    @Around(
            "execution(public * com.lazybuff.fuel.service..*(..)) && !@annotation(com.example.aspect.NoLogging)")
    public Object logPublicMethods(ProceedingJoinPoint joinPoint) throws Throwable {

        long start = System.currentTimeMillis();

        String methodName = joinPoint.getSignature().toShortString();
        Object[] args = joinPoint.getArgs();

        log.info("Starting method execution: {} | Request : {}", methodName, args);

        try {
            Object result = joinPoint.proceed();

            long timeTaken = System.currentTimeMillis() - start;

            log.info("Completed method execution in {}ms: Response: {}", timeTaken, result);

            return result;
        } catch (Exception ex) {
            throw ex;
        }
    }
}
