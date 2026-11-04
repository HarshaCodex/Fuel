package com.lazybuff.fuel.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/** Fields a user may change on their own profile. Null (or omitted) means "leave unchanged". */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode
@Builder
@Schema(
        description =
                "Send only the fields to change. An omitted field and an explicit null are treated"
                        + " the same: the value is left unchanged.")
public class UpdateProfileRequest {

    @Schema(description = "Display name, 1 to 100 characters, not blank.", example = "Harsha B")
    @Size(max = 100, message = "Name must be at most 100 characters.")
    @Pattern(regexp = ".*\\S.*", message = "Name cannot be blank.")
    private String name;

    @Schema(description = "IANA timezone id, e.g. Asia/Kolkata.", example = "Asia/Kolkata")
    @Size(max = 50, message = "Timezone must be at most 50 characters.")
    private String timezone;
}
