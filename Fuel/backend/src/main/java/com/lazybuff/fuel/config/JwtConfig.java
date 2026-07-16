package com.lazybuff.fuel.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "jwt")
@Getter
@Setter
public class JwtConfig {
    String secret;
    long accessTokenExpirySeconds;
    long refreshTokenExpirySeconds;
}
