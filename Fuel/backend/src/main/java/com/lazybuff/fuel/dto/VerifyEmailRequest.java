package com.lazybuff.fuel.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
public class VerifyEmailRequest {

    @NotBlank(message = "Email field cannot be blank.")
    @Email(
            regexp = "^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$",
            message = "Please provide a well-formated email address.")
    private String email;

    @ToString.Exclude
    @NotBlank(message = "Verification code field cannot be blank.")
    @Size(max = 10, message = "Verification code must be at most 10 characters.")
    private String verificationCode;
}
