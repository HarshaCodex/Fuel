CREATE TABLE body_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    height_cm       DECIMAL(5,1) NOT NULL,
    weight_kg       DECIMAL(5,1) NOT NULL,
    age             INTEGER NOT NULL,
    gender          VARCHAR(10) NOT NULL,
    activity_level  VARCHAR(15) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_body_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_body_stats_user UNIQUE (user_id),
    CONSTRAINT chk_body_stats_gender CHECK (gender IN ('MALE', 'FEMALE')),
    CONSTRAINT chk_body_stats_activity CHECK (activity_level IN ('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE')),
    CONSTRAINT chk_body_stats_height CHECK (height_cm BETWEEN 50.0 AND 300.0),
    CONSTRAINT chk_body_stats_weight CHECK (weight_kg BETWEEN 20.0 AND 300.0),
    CONSTRAINT chk_body_stats_age CHECK (age BETWEEN 13 AND 120)
);
