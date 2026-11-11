-- Flyway runs this before every migrate. V6 indexes food names with gin_trgm_ops, which needs the pg_trgm
-- extension, and no migration created it, so a fresh database failed at V6. A callback instead of a versioned
-- migration means databases that already ran V6 are unaffected. IF NOT EXISTS keeps it safe to repeat.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
