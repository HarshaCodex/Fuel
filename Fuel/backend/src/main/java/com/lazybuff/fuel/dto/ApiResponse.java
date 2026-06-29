package com.lazybuff.fuel.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ApiResponse<T> {

    private int status;
    private String message;
    private T data;
    private LocalDateTime timestamp;
}
