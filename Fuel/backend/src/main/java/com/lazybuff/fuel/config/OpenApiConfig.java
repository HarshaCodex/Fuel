package com.lazybuff.fuel.config;

import com.lazybuff.fuel.dto.ErrorResponse;
import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.core.converter.ResolvedSchema;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI document and Swagger UI setup.
 *
 * <p>Every operation requires a bearer access token unless it opts out with an empty
 * {@code @SecurityRequirements}. Error responses (4xx/5xx) all share the {@link ErrorResponse}
 * envelope produced by {@code GlobalExceptionHandler} and {@code RestAuthEntryPoint}, so the schema
 * is attached here once instead of on every annotation.
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER_AUTH = "bearerAuth";

    private static final String ERROR_SCHEMA_REF = "#/components/schemas/ErrorResponse";

    @Bean
    public OpenAPI fuelOpenApi() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("Fuel API")
                                .version("v1")
                                .description(
                                        "Backend for the Fuel macro-tracking app. Obtain an access"
                                                + " token from /api/auth/login, then use"
                                                + " Authorize to call protected endpoints."))
                .components(
                        new Components()
                                .addSecuritySchemes(
                                        BEARER_AUTH,
                                        new SecurityScheme()
                                                .type(SecurityScheme.Type.HTTP)
                                                .scheme("bearer")
                                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH));
    }

    @Bean
    public OpenApiCustomizer errorResponseCustomizer() {
        return openApi -> {
            ResolvedSchema resolved =
                    ModelConverters.getInstance()
                            .resolveAsResolvedSchema(new AnnotatedType(ErrorResponse.class));
            resolved.referencedSchemas.forEach(openApi.getComponents()::addSchemas);

            Content errorContent =
                    new Content()
                            .addMediaType(
                                    org.springframework.http.MediaType.APPLICATION_JSON_VALUE,
                                    new MediaType().schema(new Schema<>().$ref(ERROR_SCHEMA_REF)));

            for (PathItem path : openApi.getPaths().values()) {
                for (Operation operation : path.readOperations()) {
                    operation
                            .getResponses()
                            .forEach(
                                    (code, response) -> {
                                        if (isErrorStatus(code)) {
                                            response.setContent(errorContent);
                                        }
                                    });
                }
            }
        };
    }

    private static boolean isErrorStatus(String code) {
        return code.startsWith("4") || code.startsWith("5");
    }
}
