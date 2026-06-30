package com.lazybuff.fuel.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserRegisterRequest {

    @NotBlank(message = "Email field cannot be blank.")
    @Email(
            regexp = "^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$",
            message = "Please provide a well-formated email address.")
    @Size(min = 1, max = 255, message = "Email must be less than 255 characters.")
    private String email;

    @NotBlank(message = "Password field cannot be blank.")
    @Size(min = 8, max = 30, message = "Password must be between 8 and 20 characters.")
    @Pattern(
            regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
            message =
                    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character")
    private String password;

    @NotBlank(message = "Name cannot be blank")
    @Size(min = 1, max = 100, message = "Name must be between 1 and 100 characters.")
    private String name;
}
