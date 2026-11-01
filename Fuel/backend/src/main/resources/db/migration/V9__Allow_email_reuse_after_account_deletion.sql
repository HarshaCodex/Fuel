-- Deleted accounts are soft-deleted (deleted_at set) and purged after a grace period (#64).
-- The email must be free for a new sign-up straight away, so uniqueness now only applies to
-- active accounts. The partial index also serves the active-account email lookups.
ALTER TABLE users DROP CONSTRAINT uq_users_email;

CREATE UNIQUE INDEX uq_users_email_active ON users(email) WHERE deleted_at IS NULL;
