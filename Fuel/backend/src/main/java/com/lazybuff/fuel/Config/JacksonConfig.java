package com.lazybuff.fuel.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.deser.std.StdScalarDeserializer;
import tools.jackson.databind.module.SimpleModule;

@Configuration
public class JacksonConfig {

    @Bean
    public JacksonModule stringTrimModule() {
        SimpleModule module = new SimpleModule();
        module.addDeserializer(
                String.class,
                new StdScalarDeserializer<>(String.class) {
                    @Override
                    public String deserialize(JsonParser p, DeserializationContext ctx)
                            throws JacksonException {
                        return p.getValueAsString().strip();
                    }
                });
        return module;
    }
}
