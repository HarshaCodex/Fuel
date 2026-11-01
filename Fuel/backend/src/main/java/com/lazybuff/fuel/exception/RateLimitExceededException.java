package com.lazybuff.fuel.exception;

import java.time.Duration;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/** The caller exceeded a rate limit; {@code retryAfter} is when the current window resets. */
@Getter
public class RateLimitExceededException extends FuelException {

    private final Duration retryAfter;

    public RateLimitExceededException(String message, Duration retryAfter) {
        super(HttpStatus.TOO_MANY_REQUESTS, message);
        this.retryAfter = retryAfter;
    }
}
