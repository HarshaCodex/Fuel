package com.lazybuff.fuel.converter;

import com.lazybuff.fuel.util.ServingUnit;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Locale;

@Converter
public class LowercaseConverter implements AttributeConverter<ServingUnit, String> {

    @Override
    public String convertToDatabaseColumn(ServingUnit attribute) {
        return attribute == null ? null : attribute.toString().toLowerCase(Locale.ROOT);
    }

    @Override
    public ServingUnit convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ServingUnit.valueOf(dbData.toUpperCase(Locale.ROOT));
    }
}
