CREATE TABLE food_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(300) NOT NULL,
    brand           VARCHAR(200),
    source          VARCHAR(10) NOT NULL,
    source_id       VARCHAR(255),
    barcode         VARCHAR(20),
    serving_size    DECIMAL(7,1) NOT NULL,
    serving_unit    VARCHAR(10) NOT NULL,
    calories        DECIMAL(7,1) NOT NULL,
    protein         DECIMAL(7,2) NOT NULL,
    carbs           DECIMAL(7,2) NOT NULL,
    fat             DECIMAL(7,2) NOT NULL,
    fiber           DECIMAL(7,2) NOT NULL DEFAULT 0,
    created_by      UUID,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_food_source CHECK (source IN ('USDA', 'OFF', 'USER')),
    CONSTRAINT chk_food_serving_unit CHECK (serving_unit IN (
        'g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'serving'
    )),
    CONSTRAINT chk_food_calories CHECK (calories >= 0),
    CONSTRAINT chk_food_protein CHECK (protein >= 0),
    CONSTRAINT chk_food_carbs CHECK (carbs >= 0),
    CONSTRAINT chk_food_fat CHECK (fat >= 0),
    CONSTRAINT chk_food_fiber CHECK (fiber >= 0),
    CONSTRAINT chk_food_serving_size CHECK (serving_size > 0),
    CONSTRAINT fk_food_created_by FOREIGN KEY (created_by)
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX uq_food_source_id ON food_items(source, source_id)
    WHERE source_id IS NOT NULL;

CREATE INDEX idx_food_items_barcode ON food_items(barcode)
    WHERE barcode IS NOT NULL;

CREATE INDEX idx_food_items_created_by ON food_items(created_by)
    WHERE created_by IS NOT NULL;

CREATE INDEX idx_food_items_name_trgm ON food_items
    USING gin(name gin_trgm_ops);

CREATE INDEX idx_food_items_deleted_at ON food_items(deleted_at)
    WHERE deleted_at IS NOT NULL;