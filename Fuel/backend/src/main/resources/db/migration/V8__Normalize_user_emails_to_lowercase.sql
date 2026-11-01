-- Emails are case-insensitive, but they were stored as typed, so "Jane@Gmail.com" and
-- "jane@gmail.com" could become two accounts (#66). The application now lower-cases every email
-- before writing or looking it up; this migration normalises existing rows and enforces it.
--
-- If two accounts differ only by case, the UPDATE violates uq_users_email and the migration fails
-- on purpose: those accounts must be merged by hand rather than the database picking a winner.
UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email);

-- With every stored email lower-case, the existing uq_users_email is effectively case-insensitive.
ALTER TABLE users ADD CONSTRAINT chk_users_email_lowercase CHECK (email = LOWER(email));
