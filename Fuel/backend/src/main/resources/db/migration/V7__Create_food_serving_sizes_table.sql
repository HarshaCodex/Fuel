CREATE TABLE food_serving_sizes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id             UUID NOT NULL,
    label               VARCHAR(100) NOT NULL,
    quantity_in_grams   DECIMAL(7,1) NOT NULL,

    CONSTRAINT fk_serving_sizes_food FOREIGN KEY (food_id)
        REFERENCES food_items(id) ON DELETE CASCADE,
    CONSTRAINT chk_serving_grams CHECK (quantity_in_grams > 0)
);

CREATE INDEX idx_food_serving_sizes_food_id ON food_serving_sizes(food_id);
