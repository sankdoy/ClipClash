-- Sponsor tiers
CREATE TABLE IF NOT EXISTS sponsor_tiers (
  tier_key TEXT PRIMARY KEY,
  tier_label TEXT NOT NULL,
  max_rank INTEGER NOT NULL,
  min_avg_viewers INTEGER NOT NULL,
  baseline_cpm_usd REAL NOT NULL DEFAULT 7.0,
  discount_rate REAL NOT NULL DEFAULT 0.20,
  last_updated_iso TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'twitchmetrics',
  source_url TEXT NOT NULL DEFAULT 'https://www.twitchmetrics.net/channels/popularity'
);

-- Sponsor inquiries
CREATE TABLE IF NOT EXISTS sponsor_inquiries (
  id TEXT PRIMARY KEY,
  created_at_iso TEXT NOT NULL,
  inventory_type TEXT NOT NULL,
  tier_key TEXT,
  brand_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  tagline TEXT NOT NULL,
  image_url TEXT NOT NULL,
  notes TEXT
);
