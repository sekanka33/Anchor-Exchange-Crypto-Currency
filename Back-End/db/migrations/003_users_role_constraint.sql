-- Authorization depends on users.role, so it must always hold a known value.
-- Existing rows are kept; any NULL role (never set) becomes the least
-- privileged 'user'. Admin is never assigned here — see scripts/set-role.js.
UPDATE users SET role = 'user' WHERE role IS NULL;

ALTER TABLE users
    ALTER COLUMN role SET DEFAULT 'user',
    ALTER COLUMN role SET NOT NULL,
    ADD CONSTRAINT users_role_valid CHECK (role IN ('user', 'admin'));
