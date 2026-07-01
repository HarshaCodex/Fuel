package com.lazybuff.fuel.exception;

import com.lazybuff.fuel.dto.Error;
import com.lazybuff.fuel.dto.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException ex) {
        List<Error> errors =
                ex.getBindingResult().getFieldErrors().stream()
                        .map(
                                error ->
                                        Error.builder()
                                                .field(error.getField())
                                                .message(error.getDefaultMessage())
                                                .build())
                        .toList();

        ErrorResponse errorResponse =
                ErrorResponse.builder().errors(errors).message("Validation failed").build();

        return ResponseEntity.badRequest().body(errorResponse);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            ConstraintViolationException ex) {
        List<Error> errors =
                ex.getConstraintViolations().stream()
                        .map(
                                error ->
                                        Error.builder()
                                                .field(error.getPropertyPath().toString())
                                                .message(error.getMessage())
                                                .build())
                        .toList();

        ErrorResponse errorResponse =
                ErrorResponse.builder()
                        .status(HttpStatus.BAD_REQUEST.value())
                        .message("Validation failed")
                        .errors(errors)
                        .build();

        return ResponseEntity.badRequest().body(errorResponse);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        ErrorResponse errorResponse =
                ErrorResponse.builder()
                        .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                        .message(ex.getMessage())
                        .build();

        return ResponseEntity.internalServerError().body(errorResponse);
    }
}
