package com.lazybuff.fuel.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("OpenApiConfig")
class OpenApiConfigTest {

    private static final String JSON = "application/json";
    private static final String SUCCESS_REF = "#/components/schemas/ApiResponseUserData";

    private final OpenApiConfig openApiConfig = new OpenApiConfig();

    private OpenAPI openApi;

    @BeforeEach
    void setUp() {
        openApi = openApiConfig.fuelOpenApi();
        ApiResponses responses =
                new ApiResponses()
                        .addApiResponse(
                                "200",
                                new ApiResponse()
                                        .content(
                                                new Content()
                                                        .addMediaType(
                                                                JSON,
                                                                new MediaType()
                                                                        .schema(
                                                                                new Schema<>()
                                                                                        .$ref(
                                                                                                SUCCESS_REF)))))
                        .addApiResponse("401", new ApiResponse())
                        .addApiResponse("503", new ApiResponse());
        openApi.paths(
                new Paths()
                        .addPathItem(
                                "/api/auth/login",
                                new PathItem().post(new Operation().responses(responses))));
    }

    private ApiResponse response(String code) {
        return openApi.getPaths().get("/api/auth/login").getPost().getResponses().get(code);
    }

    private static String schemaRef(ApiResponse response) {
        return response.getContent().get(JSON).getSchema().get$ref();
    }

    @Test
    @DisplayName("requires a bearer token on every operation by default")
    void shouldRequireBearerAuthGlobally() {
        assertThat(openApi.getComponents().getSecuritySchemes()).containsKey("bearerAuth");
        assertThat(openApi.getSecurity())
                .singleElement()
                .satisfies(r -> assertThat(r).containsKey("bearerAuth"));
    }

    @Test
    @DisplayName("documents 4xx and 5xx responses with the ErrorResponse envelope")
    void shouldAttachErrorSchemaToErrorResponses() {
        openApiConfig.errorResponseCustomizer().customise(openApi);

        assertThat(schemaRef(response("401"))).isEqualTo("#/components/schemas/ErrorResponse");
        assertThat(schemaRef(response("503"))).isEqualTo("#/components/schemas/ErrorResponse");
        assertThat(openApi.getComponents().getSchemas()).containsKeys("ErrorResponse", "Error");
    }

    @Test
    @DisplayName("leaves success response schemas untouched")
    void shouldNotTouchSuccessResponses() {
        openApiConfig.errorResponseCustomizer().customise(openApi);

        assertThat(schemaRef(response("200"))).isEqualTo(SUCCESS_REF);
    }
}
