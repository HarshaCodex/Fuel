package com.lazybuff.fuel.converter;

import com.lazybuff.fuel.util.ServingUnit;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Locale;

@Converter
public class LowercaseConverter implements AttributeConverter<ServingUnit, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return attribute == null ? null : attribute.toLowerCase(Locale.ROOT);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return dbData;
    }
}