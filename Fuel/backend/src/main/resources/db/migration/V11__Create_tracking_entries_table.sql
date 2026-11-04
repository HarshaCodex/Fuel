CREATE TABLE tracking_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    food_id         UUID NOT NULL,
    food_name       VARCHAR(300) NOT NULL,
    food_source     VARCHAR(10) NOT NULL,
    serving_size    DECIMAL(7,1) NOT NULL,
    serving_unit    VARCHAR(10) NOT NULL,
    quantity        DECIMAL(5,2) NOT NULL,
    meal_label      VARCHAR(10),
    logged_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    log_date        DATE NOT NULL,
    calories        DECIMAL(7,1) NOT NULL,
    protein         DECIMAL(7,2) NOT NULL,
    carbs           DECIMAL(7,2) NOT NULL,
    fat             DECIMAL(7,2) NOT NULL,
    fiber           DECIMAL(7,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_tracking_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tracking_food FOREIGN KEY (food_id) REFERENCES food_items(id),
    CONSTRAINT chk_tracking_source CHECK (food_source IN ('USDA', 'OFF', 'USER')),
    CONSTRAINT chk_tracking_serving_unit CHECK (serving_unit IN ('g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'serving')),
    CONSTRAINT chk_tracking_meal CHECK (meal_label IS NULL OR meal_label IN ('breakfast', 'lunch', 'dinner', 'snack')),
    CONSTRAINT chk_tracking_quantity CHECK (quantity > 0),
    CONSTRAINT chk_tracking_serving CHECK (serving_size > 0),
    CONSTRAINT chk_tracking_calories CHECK (calories >= 0)
);
CREATE INDEX idx_tracking_user_date ON tracking_entries(user_id, log_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_tracking_user_food ON tracking_entries(user_id, food_id, logged_at DESC);
CREATE INDEX idx_tracking_user_logged ON tracking_entries(user_id, logged_at);
CREATE INDEX idx_tracking_deleted ON tracking_entries(deleted_at) WHERE deleted_at IS NOT NULL;
