package com.lazybuff.fuel.dto;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ErrorResponse {

    private int status;
    private String message;
    private List<Error> errors;
    private LocalDateTime timestamp;
}
