CREATE TABLE user_auth_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    provider        VARCHAR(20) NOT NULL,
    provider_id     VARCHAR(255),
    password_hash   VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_auth_providers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_auth_provider_id UNIQUE (provider, provider_id),
    CONSTRAINT uq_auth_user_provider UNIQUE (user_id, provider),
    CONSTRAINT chk_auth_provider CHECK (provider IN ('EMAIL', 'GOOGLE', 'APPLE')),
    CONSTRAINT chk_auth_password CHECK (
        (provider = 'EMAIL' AND password_hash IS NOT NULL) OR (provider != 'EMAIL' AND password_hash IS NULL)),
    CONSTRAINT chk_auth_provider_id CHECK (
        (provider = 'EMAIL' AND provider_id IS NULL) OR (provider != 'EMAIL' AND provider_id IS NOT NULL))
);
CREATE INDEX idx_auth_providers_user_id ON user_auth_providers(user_id);