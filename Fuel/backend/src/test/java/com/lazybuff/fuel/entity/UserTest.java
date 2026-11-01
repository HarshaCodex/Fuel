package com.lazybuff.fuel.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("User")
class UserTest {

    @Test
    @DisplayName("normalises the email before it is persisted or updated")
    void shouldNormaliseEmailBeforeSave() {
        User user = User.builder().email(" Jane@Example.COM ").name("Jane").build();

        user.normalizeEmail();

        assertThat(user.getEmail()).isEqualTo("jane@example.com");
    }
}
