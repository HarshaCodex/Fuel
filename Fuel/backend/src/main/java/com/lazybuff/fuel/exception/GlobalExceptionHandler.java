package com.lazybuff.fuel.exception;

import com.lazybuff.fuel.dto.Error;
import com.lazybuff.fuel.dto.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import java.time.LocalDateTime;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
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
                ErrorResponse.builder()
                        .status(HttpStatus.BAD_REQUEST.value())
                        .errors(errors)
                        .message("Validation failed")
                        .timestamp(LocalDateTime.now())
                        .build();

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
                        .timestamp(LocalDateTime.now())
                        .build();

        return ResponseEntity.badRequest().body(errorResponse);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorizedException(
            BadCredentialsException exception) {
        ErrorResponse errorResponse =
                ErrorResponse.builder()
                        .status(HttpStatus.UNAUTHORIZED.value())
                        .message("Invalid or missing credentials.")
                        .timestamp(LocalDateTime.now())
                        .build();

        return ResponseEntity.status(errorResponse.getStatus()).body(errorResponse);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(
            AccessDeniedException exception) {
        ErrorResponse errorResponse =
                ErrorResponse.builder()
                        .status(HttpStatus.FORBIDDEN.value())
                        .message("You do not have permission to access this resource.")
                        .timestamp(LocalDateTime.now())
                        .build();

        return ResponseEntity.status(errorResponse.getStatus()).body(errorResponse);
    }

    @ExceptionHandler(FuelException.class)
    public ResponseEntity<ErrorResponse> handleFuelException(FuelException ex) {
        ErrorResponse errorResponse =
                ErrorResponse.builder()
                        .status(ex.getHttpStatus().value())
                        .message(ex.getMessage())
                        .timestamp(LocalDateTime.now())
                        .build();
        return ResponseEntity.status(ex.getHttpStatus()).body(errorResponse);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        log.error("Unhandled exception", ex);

        ErrorResponse errorResponse =
                ErrorResponse.builder()
                        .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                        .message("An unexpected error occurred. Please try again later.")
                        .timestamp(LocalDateTime.now())
                        .build();

        return ResponseEntity.internalServerError().body(errorResponse);
    }
}
