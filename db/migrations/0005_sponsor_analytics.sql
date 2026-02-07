-- Link sponsors to user accounts for analytics access
ALTER TABLE sponsors ADD COLUMN account_id TEXT;
ALTER TABLE sponsors ADD COLUMN contact_email TEXT;

-- Track click-through events for sponsor campaigns
CREATE TABLE IF NOT EXISTS sponsor_clicks (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  clicked_at INTEGER NOT NULL,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS idx_sponsor_clicks_sponsor ON sponsor_clicks(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_account ON sponsors(account_id);

-- Add chat_log column to reports for moderator review
ALTER TABLE reports ADD COLUMN chat_log TEXT;
ALTER TABLE reports ADD COLUMN reported_player_id TEXT;
ALTER TABLE reports ADD COLUMN reported_player_name TEXT;
ALTER TABLE reports ADD COLUMN message_text TEXT;
