package com.lazybuff.fuel.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Builder
public class ErrorResponse {

    private int status;
    private String message;
    private List<Error> errors;
    private LocalDateTime timestamp;

    /** Seconds until a rate-limited caller may retry; only present on 429 responses. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Long retryAfter;
}
