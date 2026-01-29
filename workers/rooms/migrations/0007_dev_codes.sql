-- Add plaintext code column for development mode
-- This column should ONLY be populated when DEV_MODE=true
-- In production with real email, this should remain NULL
ALTER TABLE auth_codes ADD COLUMN code_plaintext TEXT;
