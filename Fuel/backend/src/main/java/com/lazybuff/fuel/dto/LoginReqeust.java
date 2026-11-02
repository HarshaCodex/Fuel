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
public class LoginReqeust {

    @NotBlank(message = "Email field cannot be blank.")
    @Email(
            regexp = "^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$",
            message = "Please provide a well-formated email address.")
    @Size(min = 1, max = 255, message = "Email must be less than 255 characters.")
    private String email;

    // No complexity rules here: they may change, and existing passwords must keep working (#88).
    @NotBlank(message = "Password field cannot be blank.")
    @Size(max = 128, message = "Password must be at most 128 characters.")
    private String password;
}
