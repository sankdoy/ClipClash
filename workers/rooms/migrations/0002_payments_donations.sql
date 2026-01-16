-- Payments + donations updates
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE entitlements ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE entitlements ADD COLUMN audience_mode_purchased_at TEXT;
ALTER TABLE entitlements ADD COLUMN audience_mode_session_id TEXT;
ALTER TABLE entitlements ADD COLUMN audience_mode_payment_intent_id TEXT;

ALTER TABLE donations ADD COLUMN currency TEXT DEFAULT 'usd';
ALTER TABLE donations ADD COLUMN message_moderation_status TEXT DEFAULT 'ok';
ALTER TABLE donations ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE donations ADD COLUMN stripe_checkout_session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payments_payment_intent_idx ON payments(stripe_payment_intent_id);
CREATE UNIQUE INDEX IF NOT EXISTS donations_payment_intent_idx ON donations(stripe_payment_intent_id);
