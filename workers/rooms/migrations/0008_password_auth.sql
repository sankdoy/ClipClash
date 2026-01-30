-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
