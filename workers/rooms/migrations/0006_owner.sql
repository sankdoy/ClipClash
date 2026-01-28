-- Owner flag for privileged access
ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_is_owner ON users(is_owner);
