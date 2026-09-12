CREATE TABLE verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_verification_code_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_verification_type CHECK (type in ('EMAIL_VERIFY', 'PASSWORD_RESET'))
);

CREATE INDEX idx_verification_codes_user_type ON verification_codes(user_id, type);