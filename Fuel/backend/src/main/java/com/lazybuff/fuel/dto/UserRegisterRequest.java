package com.lazybuff.fuel.dto;

import com.lazybuff.fuel.validation.NewPassword;
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
public class UserRegisterRequest {

    @NotBlank(message = "Email field cannot be blank.")
    @Email(
            regexp = "^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$",
            message = "Please provide a well-formated email address.")
    @Size(min = 1, max = 255, message = "Email must be less than 255 characters.")
    private String email;

    @ToString.Exclude @NewPassword private String password;

    @NotBlank(message = "Name cannot be blank")
    @Size(min = 1, max = 100, message = "Name must be between 1 and 100 characters.")
    private String name;

    @NotBlank(message = "Timezone cannot be blank.")
    @Size(max = 50, message = "Timezone must be at most 50 characters.")
    private String timezone;
}
