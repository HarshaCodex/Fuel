package com.lazybuff.fuel.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;

/** Checks {@link MaxUtf8Bytes}. */
public class MaxUtf8BytesValidator implements ConstraintValidator<MaxUtf8Bytes, String> {

    private int maxBytes;

    @Override
    public void initialize(MaxUtf8Bytes constraint) {
        maxBytes = constraint.value();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        return value == null || value.getBytes(StandardCharsets.UTF_8).length <= maxBytes;
    }
}
