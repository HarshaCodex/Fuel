package com.lazybuff.fuel.exception;

import lombok.Getter;
import lombok.Setter;
import org.springframework.http.HttpStatus;

@Getter
@Setter
public class FuelException extends RuntimeException {

    private final HttpStatus httpStatus;

    public FuelException(HttpStatus httpStatus, String message) {
        super(message);
        this.httpStatus = httpStatus;
    }
}
