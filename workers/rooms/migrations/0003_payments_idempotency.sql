CREATE UNIQUE INDEX IF NOT EXISTS payments_checkout_session_idx ON payments(stripe_checkout_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS donations_checkout_session_idx ON donations(stripe_checkout_session_id);
